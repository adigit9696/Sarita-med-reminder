import type { Customer, CustomerMedicine, CustomerMatchReport, UploadBatch, MargDataCheckReport } from '@/types';
import { 
  normalizeName, 
  normalizePhone, 
  computeDueDate, 
  computeAlertDate, 
  generateDeterministicCustomerId,
  deriveMonthInfo,
  type ParsedMargBatch 
} from './marg-parser';

export interface MergeResult {
  updatedMasterCustomers: Customer[];
  matchedMonthlyCount: number;
  newCustomersCount: number;
  newCustomers: Customer[];
  report: CustomerMatchReport;
}

export interface PatientLatestSource {
  date: string;
  fileName: string;
}

export interface ChronologicalBatchMergeResult {
  updatedMasterCustomers: Customer[];
  matchedMonthlyCount: number;
  newCustomersCount: number;
  newCustomers: Customer[];
  totalVisitsProcessed: number;
  totalUniquePatients: number;
  batchesProcessedCount: number;
  dateDistribution: Record<string, number>;
  patientLatestBillSource: Map<string, PatientLatestSource>;
  earliestDate: string;
  latestDate: string;
  consolidatedBatch: UploadBatch;
  sortedBatches: ParsedMargBatch[];
  allDetectedDates: string[];
  dataCheck?: MargDataCheckReport;
}

/**
 * Deduplicates an array of customers strictly by 10-digit phone, Marg ERP code, or normalized name.
 * Consolidates duplicate records into a single master profile, combining all medicines and preserving monthly status.
 */
export function deduplicateCustomerList(customers: Customer[]): Customer[] {
  const masterMap = new Map<string, Customer>();
  const phoneToKey = new Map<string, string>();
  const codeToKey = new Map<string, string>();
  const nameToKey = new Map<string, string>();

  customers.forEach(cust => {
    const rawPhone = cust.phoneNorm || (cust.phone ? String(cust.phone).replace(/\D/g, '') : undefined);
    const phone = rawPhone && rawPhone.length >= 10 ? rawPhone.slice(-10) : undefined;
    const code = cust.code && cust.code.trim().length > 0 ? cust.code.trim().toLowerCase() : undefined;
    const name = cust.nameNorm || normalizeName(cust.name);

    // Check if customer already exists in lookup
    let existingKey: string | undefined;
    if (masterMap.has(cust.id)) {
      existingKey = cust.id;
    } else if (phone && phoneToKey.has(phone)) {
      existingKey = phoneToKey.get(phone);
    } else if (code && codeToKey.has(code)) {
      existingKey = codeToKey.get(code);
    } else if (!phone && !code && name && nameToKey.has(name)) {
      existingKey = nameToKey.get(name);
    }

    if (existingKey && masterMap.has(existingKey)) {
      const existing = masterMap.get(existingKey)!;
      // Merge properties safely
      if (cust.isMonthlyRegular && !existing.isMonthlyRegular) {
        existing.isMonthlyRegular = true;
      }
      if (!existing.phone && cust.phone) {
        existing.phone = cust.phone;
        existing.phoneNorm = phone;
      }
      if (!existing.code && cust.code) {
        existing.code = cust.code;
      }
      if (cust.lastPurchaseDate && cust.lastPurchaseDate > existing.lastPurchaseDate) {
        existing.lastPurchaseDate = cust.lastPurchaseDate;
        existing.nextDueDate = cust.nextDueDate;
        existing.alertDate = cust.alertDate;
      }

      // Merge medicines so none are lost
      const medMap = new Map<string, CustomerMedicine>();
      existing.medicines.forEach(m => medMap.set(m.nameNorm, m));
      cust.medicines.forEach(m => {
        if (!medMap.has(m.nameNorm)) {
          medMap.set(m.nameNorm, m);
        }
      });
      existing.medicines = Array.from(medMap.values());
      existing.totalSpend = Math.max(existing.totalSpend || 0, cust.totalSpend || 0);
      existing.totalPurchases = Math.max(existing.totalPurchases || 1, cust.totalPurchases || 1);
      existing.updatedAt = new Date().toISOString();
    } else {
      // Create new clean unique entry
      const key = generateDeterministicCustomerId(phone, code, name);
      const cleanCust: Customer = {
        ...cust,
        id: key,
        phoneNorm: phone,
        nameNorm: name,
        medicines: cust.medicines || [],
      };
      masterMap.set(key, cleanCust);
      if (phone) phoneToKey.set(phone, key);
      if (code) codeToKey.set(code, key);
      if (!phone && !code && name) nameToKey.set(name, key);
    }
  });

  return Array.from(masterMap.values());
}

/**
 * Matches newly uploaded batch customers against the existing customer database.
 * Detects repeat monthly customers without duplicating any patient record.
 */
export function matchAndMergeCustomers(
  existingCustomers: Customer[],
  incomingCustomers: Customer[],
  defaultCycleDays: number = 30,
  alertDaysBefore: number = 5
): MergeResult {
  // 1. First ensure existing database is clean & deduplicated
  const cleanExisting = deduplicateCustomerList(existingCustomers);

  // Build lookup indexes for fast O(1) matching
  const phoneIndex = new Map<string, Customer>();
  const codeIndex = new Map<string, Customer>();
  const nameIndex = new Map<string, Customer>();
  const masterMap = new Map<string, Customer>();

  cleanExisting.forEach(cust => {
    masterMap.set(cust.id, { ...cust });
    const c = masterMap.get(cust.id)!;
    if (c.phoneNorm) phoneIndex.set(c.phoneNorm, c);
    if (c.code) codeIndex.set(c.code.trim().toLowerCase(), c);
    if (!c.phoneNorm && !c.code && c.nameNorm) nameIndex.set(c.nameNorm, c);
  });

  const report: CustomerMatchReport = {
    totalInFile: incomingCustomers.length,
    newCustomers: [],
    matchedMonthlyCustomers: [],
  };

  const newCustomersList: Customer[] = [];

  incomingCustomers.forEach(incoming => {
    let matchedExisting: Customer | undefined;
    let matchType: 'phone' | 'code' | 'name' = 'name';

    // 1. Primary Match: 10-digit Phone
    if (incoming.phoneNorm && phoneIndex.has(incoming.phoneNorm)) {
      matchedExisting = phoneIndex.get(incoming.phoneNorm);
      matchType = 'phone';
    }
    // 2. Secondary Match: Marg ERP Patient Code
    else if (incoming.code && codeIndex.has(incoming.code.trim().toLowerCase())) {
      matchedExisting = codeIndex.get(incoming.code.trim().toLowerCase());
      matchType = 'code';
    }
    // 3. Fallback Match: Exact ID Match
    else if (masterMap.has(incoming.id)) {
      matchedExisting = masterMap.get(incoming.id);
      matchType = 'name';
    }
    // 4. Fallback Match: Normalized Full Name (strictly for name-only customers)
    else if (!incoming.phoneNorm && !incoming.code && incoming.nameNorm && nameIndex.has(incoming.nameNorm)) {
      matchedExisting = nameIndex.get(incoming.nameNorm);
      matchType = 'name';
    }

    if (matchedExisting) {
      // Auto-filter rule: Bills >= ₹1,000 automatically added to Monthly Customers; otherwise retain prior staff choice
      if (incoming.totalSpend >= 1000 || incoming.isMonthlyRegular) {
        matchedExisting.isMonthlyRegular = true;
      } else {
        matchedExisting.isMonthlyRegular = Boolean(matchedExisting.isMonthlyRegular);
      }

      // Idempotent purchase tracking: Only increment months/purchases if this is a newer period
      const isNewerPeriod = incoming.lastPurchaseDate > matchedExisting.lastPurchaseDate;
      if (isNewerPeriod) {
        matchedExisting.monthsActive = (matchedExisting.monthsActive || 1) + 1;
        matchedExisting.totalPurchases = (matchedExisting.totalPurchases || 1) + 1;
        matchedExisting.lastPurchaseDate = incoming.lastPurchaseDate;
      }
      matchedExisting.regularityScore = Math.min(100, Math.max(80, (matchedExisting.regularityScore || 50) + 25));

      // Update phone or code if incoming has it and existing was missing it
      if (!matchedExisting.phone && incoming.phone) {
        matchedExisting.phone = incoming.phone;
        matchedExisting.phoneNorm = incoming.phoneNorm;
      }
      if (!matchedExisting.code && incoming.code) {
        matchedExisting.code = incoming.code;
      }

      // Customer-level refill duration: use existing customer's duration or incoming or fallback
      const customerCycle = (matchedExisting.refillCycleDays && matchedExisting.refillCycleDays > 0)
        ? matchedExisting.refillCycleDays
        : ((incoming.refillCycleDays && incoming.refillCycleDays > 0) ? incoming.refillCycleDays : defaultCycleDays);
      matchedExisting.refillCycleDays = customerCycle;

      // Update next due date and alert date using customer's own duration
      matchedExisting.nextDueDate = computeDueDate(matchedExisting.lastPurchaseDate, customerCycle);
      matchedExisting.alertDate = computeAlertDate(matchedExisting.nextDueDate, alertDaysBefore);

      // Merge Medicines intelligently: do not overwrite real medicines with placeholder
      const hasRealMeds = matchedExisting.medicines && matchedExisting.medicines.some(m => !m.name.startsWith('Prescription Bill'));
      const incomingIsPlaceholder = incoming.medicines.length === 1 && incoming.medicines[0].name.startsWith('Prescription Bill');

      if (incomingIsPlaceholder) {
        if (!hasRealMeds) {
          matchedExisting.medicines = incoming.medicines;
        }
        matchedExisting.totalSpend = (matchedExisting.totalSpend || 0) + incoming.totalSpend;
      } else if (incoming.medicines.length > 0) {
        const medMap = new Map<string, CustomerMedicine>();
        matchedExisting.medicines.forEach(m => medMap.set(m.nameNorm, m));

        incoming.medicines.forEach(inMed => {
          if (medMap.has(inMed.nameNorm)) {
            const existMed = medMap.get(inMed.nameNorm)!;
            existMed.status = 'regular';
            existMed.qty = inMed.qty;
            existMed.amount = inMed.amount;
            existMed.refillCycleDays = customerCycle;
            if (isNewerPeriod) {
              existMed.lastPurchaseDate = inMed.lastPurchaseDate;
              existMed.nextDueDate = computeDueDate(inMed.lastPurchaseDate, customerCycle);
            }
            if (inMed.packaging) existMed.packaging = inMed.packaging;
          } else {
            // New medicine added to customer's prescription
            medMap.set(inMed.nameNorm, {
              ...inMed,
              refillCycleDays: customerCycle,
              status: 'new',
            });
          }
        });

        matchedExisting.medicines = Array.from(medMap.values());
        matchedExisting.totalSpend = matchedExisting.medicines.reduce((acc, m) => acc + (m.amount || 0), 0);
      } else {
        matchedExisting.totalSpend = (matchedExisting.totalSpend || 0) + incoming.totalSpend;
      }
      matchedExisting.updatedAt = new Date().toISOString();

      report.matchedMonthlyCustomers.push({
        existing: matchedExisting,
        incoming,
        matchType,
      });
    } else {
      // ===== NEW CUSTOMER ONLY =====
      const isOver1000 = Boolean(incoming.totalSpend >= 1000 || incoming.isMonthlyRegular);
      const deterministicId = generateDeterministicCustomerId(incoming.phoneNorm, incoming.code, incoming.nameNorm);
      const newCust: Customer = {
        ...incoming,
        id: deterministicId,
        isMonthlyRegular: isOver1000, // AUTO-FILTER: >= ₹1,000 auto-selected for Monthly Customers; under ₹1,000 unselected
        regularityScore: isOver1000 ? 95 : 40,
        refillCycleDays: incoming.refillCycleDays && incoming.refillCycleDays > 0 ? incoming.refillCycleDays : defaultCycleDays,
        nextDueDate: computeDueDate(incoming.lastPurchaseDate, defaultCycleDays),
        alertDate: computeAlertDate(computeDueDate(incoming.lastPurchaseDate, defaultCycleDays), alertDaysBefore),
      };

      masterMap.set(newCust.id, newCust);
      if (newCust.phoneNorm) phoneIndex.set(newCust.phoneNorm, newCust);
      if (newCust.code) codeIndex.set(newCust.code.trim().toLowerCase(), newCust);
      if (newCust.nameNorm) nameIndex.set(newCust.nameNorm, newCust);

      report.newCustomers.push(newCust);
      newCustomersList.push(newCust);
    }
  });

  return {
    updatedMasterCustomers: Array.from(masterMap.values()),
    matchedMonthlyCount: report.matchedMonthlyCustomers.length,
    newCustomersCount: report.newCustomers.length,
    newCustomers: newCustomersList,
    report,
  };
}

/**
 * Merges multiple daily or date-specific parsed Marg batches chronologically into master customer records.
 * 
 * Guarantees:
 * 1. Zero duplicate customers (strictly deduplicated by 10-digit phone, Marg code, or normalized name).
 * 2. Every customer's lastPurchaseDate is accurately set to their most recent purchase across all daily sheets.
 * 3. Next refill date and 5-day alert date are recalculated from the customer's exact latest bill date and their refill duration.
 * 4. Existing staff manual monthly selection (isMonthlyRegular) is 100% preserved.
 * 5. Generates a clean consolidated UploadBatch for the entire folder/multi-file upload.
 */
export function matchAndMergeChronologicalBatches(
  existingCustomers: Customer[],
  parsedBatches: ParsedMargBatch[],
  defaultCycleDays: number = 30,
  alertDaysBefore: number = 5,
  folderName?: string
): ChronologicalBatchMergeResult {
  if (!parsedBatches || parsedBatches.length === 0) {
    const clean = deduplicateCustomerList(existingCustomers);
    const emptyBatch: UploadBatch = {
      id: 'batch_' + Date.now(),
      fileName: 'Empty Batch',
      fileSize: 0,
      uploadDate: new Date().toISOString(),
      periodStart: '',
      periodEnd: '',
      formatType: 'MARG_GROUPED_SUMMARY',
      totalRows: 0,
      totalCustomers: 0,
      newCustomersCount: 0,
      repeatCustomersCount: 0,
      status: 'committed',
      customerIds: [],
    };
    return {
      updatedMasterCustomers: clean,
      matchedMonthlyCount: 0,
      newCustomersCount: 0,
      newCustomers: [],
      totalVisitsProcessed: 0,
      totalUniquePatients: clean.length,
      batchesProcessedCount: 0,
      dateDistribution: {},
      patientLatestBillSource: new Map(),
      earliestDate: '',
      latestDate: '',
      consolidatedBatch: emptyBatch,
      sortedBatches: [],
      allDetectedDates: [],
    };
  }

  // 1. Sort batches strictly chronologically by periodEnd ascending
  const sortedBatches = [...parsedBatches].sort((a, b) => {
    const dateA = a.periodEnd || a.periodStart || '';
    const dateB = b.periodEnd || b.periodStart || '';
    return dateA.localeCompare(dateB) || (a.fileName || '').localeCompare(b.fileName || '');
  });

  // 2. Initialize deduplicated master lookup
  const cleanExisting = deduplicateCustomerList(existingCustomers);
  const masterMap = new Map<string, Customer>();
  const phoneIndex = new Map<string, Customer>();
  const codeIndex = new Map<string, Customer>();
  const nameIndex = new Map<string, Customer>();

  cleanExisting.forEach(cust => {
    masterMap.set(cust.id, { ...cust });
    const c = masterMap.get(cust.id)!;
    if (c.phoneNorm) phoneIndex.set(c.phoneNorm, c);
    if (c.code) codeIndex.set(c.code.trim().toLowerCase(), c);
    // STRICT: nameIndex ONLY holds customers with neither phone nor code
    if (!c.phoneNorm && !c.code && c.nameNorm) nameIndex.set(c.nameNorm, c);
  });

  const newCustomersMap = new Map<string, Customer>();
  const matchedCustomerIds = new Set<string>();
  const dateDistribution: Record<string, number> = {};
  const patientLatestBillSource = new Map<string, PatientLatestSource>();
  let totalVisitsProcessed = 0;
  let totalRowsProcessed = 0;
  let totalFileSize = 0;

  let earliestDate = sortedBatches[0]?.periodStart || sortedBatches[0]?.periodEnd || '';
  let latestDate = sortedBatches[sortedBatches.length - 1]?.periodEnd || sortedBatches[sortedBatches.length - 1]?.periodStart || '';

  // 3. Process batches sequentially in chronological order
  sortedBatches.forEach(batch => {
    if (!batch) return;
    totalRowsProcessed += batch.totalRowsProcessed || 0;
    totalFileSize += batch.fileSize || 0;

    const bStart = batch.periodStart || batch.periodEnd;
    const bEnd = batch.periodEnd || batch.periodStart;
    if (bStart && (!earliestDate || bStart < earliestDate)) earliestDate = bStart;
    if (bEnd && (!latestDate || bEnd > latestDate)) latestDate = bEnd;

    const batchPeriodKey = (batch.periodStart && batch.periodEnd)
      ? `${batch.periodStart}_${batch.periodEnd}`
      : undefined;

    const batchCustomers = batch.customers || [];
    batchCustomers.forEach(incoming => {
      if (!incoming) return;
      totalVisitsProcessed++;
      const pDate = incoming.lastPurchaseDate || bEnd || new Date().toISOString().split('T')[0];
      dateDistribution[pDate] = (dateDistribution[pDate] || 0) + 1;

      // Find matching existing customer in master
      let matchedExisting: Customer | undefined;

      // 1. Exact ID
      if (masterMap.has(incoming.id)) {
        matchedExisting = masterMap.get(incoming.id);
      }
      // 2. Phone
      else if (incoming.phoneNorm && phoneIndex.has(incoming.phoneNorm)) {
        matchedExisting = phoneIndex.get(incoming.phoneNorm);
      }
      // 3. Code
      else if (incoming.code && codeIndex.has(incoming.code.trim().toLowerCase())) {
        matchedExisting = codeIndex.get(incoming.code.trim().toLowerCase());
      }
      // 4. Name-only (strictly for customers without phone or code)
      else if (!incoming.phoneNorm && !incoming.code && incoming.nameNorm && nameIndex.has(incoming.nameNorm)) {
        matchedExisting = nameIndex.get(incoming.nameNorm);
      }

      if (matchedExisting) {
        matchedCustomerIds.add(matchedExisting.id);

        // Re-upload idempotency check
        const isAlreadyImported = Boolean(
          batch.formatType === 'MARG_BILL_WISE_STATEMENT' &&
          batchPeriodKey &&
          matchedExisting.lastBillWisePeriod === batchPeriodKey
        );

        // Auto-filter rule: Bills >= ₹1,000 auto-selected for Monthly Customers; otherwise retain prior staff choice
        if (incoming.totalSpend >= 1000 || incoming.isMonthlyRegular) {
          matchedExisting.isMonthlyRegular = true;
        } else {
          matchedExisting.isMonthlyRegular = Boolean(matchedExisting.isMonthlyRegular);
        }

        // Check if incoming bill is on or after current recorded date
        const isNewerOrSame = !matchedExisting.lastPurchaseDate || pDate >= matchedExisting.lastPurchaseDate;

        const customerCycle = (matchedExisting.refillCycleDays && matchedExisting.refillCycleDays > 0)
          ? matchedExisting.refillCycleDays
          : ((incoming.refillCycleDays && incoming.refillCycleDays > 0) ? incoming.refillCycleDays : defaultCycleDays);
        matchedExisting.refillCycleDays = customerCycle;

        if (isNewerOrSame) {
          // If this is a later day in the month, increment active tracking (unless already imported)
          if (pDate > matchedExisting.lastPurchaseDate && !isAlreadyImported) {
            matchedExisting.monthsActive = (matchedExisting.monthsActive || 1) + 1;
          }
          matchedExisting.lastPurchaseDate = pDate;
          matchedExisting.nextDueDate = computeDueDate(matchedExisting.lastPurchaseDate, customerCycle);
          matchedExisting.alertDate = computeAlertDate(matchedExisting.nextDueDate, alertDaysBefore);

          // Update phone / code if previously missing
          if (!matchedExisting.phone && incoming.phone) {
            matchedExisting.phone = incoming.phone;
            matchedExisting.phoneNorm = incoming.phoneNorm;
            if (matchedExisting.phoneNorm) phoneIndex.set(matchedExisting.phoneNorm, matchedExisting);
          }
          if (!matchedExisting.code && incoming.code) {
            matchedExisting.code = incoming.code;
            codeIndex.set(matchedExisting.code.trim().toLowerCase(), matchedExisting);
          }

          // Record latest bill source for transparency
          patientLatestBillSource.set(matchedExisting.id, {
            date: pDate,
            fileName: batch.fileName,
          });

          // Merge medicines: preserve real medicines if incoming is only a placeholder
          const hasRealMeds = matchedExisting.medicines && matchedExisting.medicines.some(m => !m.name.startsWith('Prescription Bill'));
          const incomingIsPlaceholder = incoming.medicines.length === 1 && incoming.medicines[0].name.startsWith('Prescription Bill');

          if (incomingIsPlaceholder) {
            if (!hasRealMeds) {
              matchedExisting.medicines = incoming.medicines;
            }
          } else if (incoming.medicines.length > 0) {
            const medMap = new Map<string, CustomerMedicine>();
            matchedExisting.medicines.forEach(m => medMap.set(m.nameNorm, m));

            incoming.medicines.forEach(inMed => {
              if (medMap.has(inMed.nameNorm)) {
                const existMed = medMap.get(inMed.nameNorm)!;
                existMed.status = 'regular';
                existMed.qty = inMed.qty;
                existMed.amount = inMed.amount;
                existMed.refillCycleDays = customerCycle;
                existMed.lastPurchaseDate = pDate;
                existMed.nextDueDate = matchedExisting.nextDueDate;
                if (inMed.packaging) existMed.packaging = inMed.packaging;
              } else {
                medMap.set(inMed.nameNorm, {
                  ...inMed,
                  refillCycleDays: customerCycle,
                  status: 'regular',
                  lastPurchaseDate: pDate,
                  nextDueDate: matchedExisting.nextDueDate,
                });
              }
            });

            matchedExisting.medicines = Array.from(medMap.values());
          }
        } else {
          // Incoming bill is older than already recorded date: merge any missing medicines only (if not placeholder)
          const incomingIsPlaceholder = incoming.medicines.length === 1 && incoming.medicines[0].name.startsWith('Prescription Bill');
          if (!incomingIsPlaceholder && incoming.medicines.length > 0) {
            const medMap = new Map<string, CustomerMedicine>();
            matchedExisting.medicines.forEach(m => medMap.set(m.nameNorm, m));
            incoming.medicines.forEach(inMed => {
              if (!medMap.has(inMed.nameNorm)) {
                medMap.set(inMed.nameNorm, {
                  ...inMed,
                  refillCycleDays: customerCycle,
                  status: 'regular',
                });
              }
            });
            matchedExisting.medicines = Array.from(medMap.values());
          }
        }

        // Only accumulate purchases and spend if not already imported from this bill-wise period
        if (!isAlreadyImported) {
          matchedExisting.totalPurchases = (matchedExisting.totalPurchases || 1) + 1;
          matchedExisting.totalSpend = (matchedExisting.totalSpend || 0) + (incoming.totalSpend || 0);
          if (batchPeriodKey) {
            matchedExisting.lastBillWisePeriod = batchPeriodKey;
          }
        }
        matchedExisting.regularityScore = Math.min(100, Math.max(80, (matchedExisting.regularityScore || 50) + 15));
        matchedExisting.updatedAt = new Date().toISOString();
      } else {
        // ===== BRAND NEW CUSTOMER =====
        const isOver1000 = Boolean(incoming.totalSpend >= 1000 || incoming.isMonthlyRegular);
        const deterministicId = generateDeterministicCustomerId(incoming.phoneNorm, incoming.code, incoming.nameNorm);
        const customerCycle = incoming.refillCycleDays && incoming.refillCycleDays > 0 ? incoming.refillCycleDays : defaultCycleDays;
        const nextDue = computeDueDate(pDate, customerCycle);

        const newCust: Customer = {
          ...incoming,
          id: deterministicId,
          isMonthlyRegular: isOver1000, // AUTO-FILTER: >= ₹1,000 auto-selected for Monthly Customers; under ₹1,000 unselected
          regularityScore: isOver1000 ? 95 : 40,
          refillCycleDays: customerCycle,
          lastPurchaseDate: pDate,
          firstPurchaseDate: incoming.firstPurchaseDate || pDate,
          nextDueDate: nextDue,
          alertDate: computeAlertDate(nextDue, alertDaysBefore),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastBillWisePeriod: batchPeriodKey,
        };

        masterMap.set(newCust.id, newCust);
        if (newCust.phoneNorm) phoneIndex.set(newCust.phoneNorm, newCust);
        if (newCust.code) codeIndex.set(newCust.code.trim().toLowerCase(), newCust);
        if (!newCust.phoneNorm && !newCust.code && newCust.nameNorm) {
          nameIndex.set(newCust.nameNorm, newCust);
        }

        newCustomersMap.set(newCust.id, newCust);
        patientLatestBillSource.set(newCust.id, {
          date: pDate,
          fileName: batch.fileName,
        });
      }
    });
  });

  const allUpdatedMasterCustomers = Array.from(masterMap.values());
  const allMasterBatchIds = Array.from(new Set([
    ...Array.from(matchedCustomerIds),
    ...Array.from(newCustomersMap.keys())
  ]));

  const monthInfo = deriveMonthInfo(earliestDate, latestDate, folderName || sortedBatches[0]?.fileName || 'daily_batch');

  // Consolidated Batch Record
  const isMultiFile = sortedBatches.length > 1;
  const cleanBatchName = folderName
    ? `${folderName} (${sortedBatches.length} Daily Sheets)`
    : isMultiFile
      ? `${monthInfo.monthName} Multi-Day (${sortedBatches.length} Sheets)`
      : sortedBatches[0].fileName;

  const dataCheck = sortedBatches.find(b => b.dataCheck)?.dataCheck;

  const consolidatedBatch: UploadBatch = {
    id: 'batch_' + Date.now(),
    fileName: cleanBatchName,
    originalFileName: folderName || sortedBatches[0]?.originalFileName || sortedBatches[0]?.fileName,
    monthName: monthInfo.monthName,
    monthKey: monthInfo.monthKey,
    fileSize: totalFileSize,
    uploadDate: new Date().toISOString(),
    periodStart: earliestDate,
    periodEnd: latestDate,
    formatType: sortedBatches[0]?.formatType || 'MARG_GROUPED_SUMMARY',
    totalRows: totalRowsProcessed,
    totalCustomers: allMasterBatchIds.length,
    newCustomersCount: newCustomersMap.size,
    repeatCustomersCount: matchedCustomerIds.size,
    status: 'committed',
    customerIds: allMasterBatchIds,
    newCustomers: Array.from(newCustomersMap.values()),
    isFolderBatch: isMultiFile,
    folderName: folderName || undefined,
    filesCount: sortedBatches.length,
    dailyFilesList: sortedBatches.map(b => b.fileName),
    dataCheck,
  };

  const allDetectedDates = Object.keys(dateDistribution).sort();

  return {
    updatedMasterCustomers: allUpdatedMasterCustomers,
    matchedMonthlyCount: matchedCustomerIds.size,
    newCustomersCount: newCustomersMap.size,
    newCustomers: Array.from(newCustomersMap.values()),
    totalVisitsProcessed,
    totalUniquePatients: allMasterBatchIds.length,
    batchesProcessedCount: sortedBatches.length,
    dateDistribution,
    patientLatestBillSource,
    earliestDate,
    latestDate,
    consolidatedBatch,
    sortedBatches,
    allDetectedDates,
    dataCheck,
  };
}

