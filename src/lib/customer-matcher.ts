import type { Customer, CustomerMedicine, CustomerMatchReport } from '@/types';
import { normalizeName, normalizePhone, computeDueDate, computeAlertDate, generateDeterministicCustomerId } from './marg-parser';

export interface MergeResult {
  updatedMasterCustomers: Customer[];
  matchedMonthlyCount: number;
  newCustomersCount: number;
  newCustomers: Customer[];
  report: CustomerMatchReport;
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
    if (phone && phoneToKey.has(phone)) {
      existingKey = phoneToKey.get(phone);
    } else if (code && codeToKey.has(code)) {
      existingKey = codeToKey.get(code);
    } else if (name && nameToKey.has(name)) {
      existingKey = nameToKey.get(name);
    } else if (masterMap.has(cust.id)) {
      existingKey = cust.id;
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
      if (name) nameToKey.set(name, key);
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
    if (c.nameNorm) nameIndex.set(c.nameNorm, c);
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
    // 3. Fallback Match: Normalized Full Name
    else if (incoming.nameNorm && nameIndex.has(incoming.nameNorm)) {
      matchedExisting = nameIndex.get(incoming.nameNorm);
      matchType = 'name';
    }

    if (matchedExisting) {
      // Strict Rule: Preserve existing manual staff selection (never auto-tick)
      matchedExisting.isMonthlyRegular = Boolean(matchedExisting.isMonthlyRegular);
      matchedExisting.monthsActive = (matchedExisting.monthsActive || 1) + 1;
      matchedExisting.totalPurchases = (matchedExisting.totalPurchases || 1) + 1;
      matchedExisting.regularityScore = Math.min(100, Math.max(80, (matchedExisting.regularityScore || 50) + 25));

      // Update phone or code if incoming has it and existing was missing it
      if (!matchedExisting.phone && incoming.phone) {
        matchedExisting.phone = incoming.phone;
        matchedExisting.phoneNorm = incoming.phoneNorm;
      }
      if (!matchedExisting.code && incoming.code) {
        matchedExisting.code = incoming.code;
      }

      // Update last purchase date
      if (incoming.lastPurchaseDate > matchedExisting.lastPurchaseDate) {
        matchedExisting.lastPurchaseDate = incoming.lastPurchaseDate;
      }

      // Update next due date and alert date
      matchedExisting.nextDueDate = computeDueDate(matchedExisting.lastPurchaseDate, defaultCycleDays);
      matchedExisting.alertDate = computeAlertDate(matchedExisting.nextDueDate, alertDaysBefore);

      // Merge Medicines intelligently
      const medMap = new Map<string, CustomerMedicine>();
      matchedExisting.medicines.forEach(m => medMap.set(m.nameNorm, m));

      incoming.medicines.forEach(inMed => {
        if (medMap.has(inMed.nameNorm)) {
          const existMed = medMap.get(inMed.nameNorm)!;
          existMed.status = 'regular';
          existMed.qty = inMed.qty;
          existMed.amount = inMed.amount;
          existMed.lastPurchaseDate = inMed.lastPurchaseDate;
          existMed.nextDueDate = inMed.nextDueDate;
          if (inMed.packaging) existMed.packaging = inMed.packaging;
        } else {
          // New medicine added to customer's prescription
          medMap.set(inMed.nameNorm, {
            ...inMed,
            status: 'new',
          });
        }
      });

      matchedExisting.medicines = Array.from(medMap.values());
      matchedExisting.totalSpend = (matchedExisting.totalSpend || 0) + incoming.totalSpend;
      matchedExisting.updatedAt = new Date().toISOString();

      report.matchedMonthlyCustomers.push({
        existing: matchedExisting,
        incoming,
        matchType,
      });
    } else {
      // ===== NEW CUSTOMER ONLY =====
      const deterministicId = generateDeterministicCustomerId(incoming.phoneNorm, incoming.code, incoming.nameNorm);
      const newCust: Customer = {
        ...incoming,
        id: deterministicId,
        isMonthlyRegular: false, // Strict Rule: new customers from Excel are ALWAYS saved as Unselected
        regularityScore: 40,
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
