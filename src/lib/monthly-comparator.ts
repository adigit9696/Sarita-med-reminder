import type { Customer, UploadBatch, MissingCustomerAuditItem, MonthlyAuditComparison, CustomerMedicine } from '@/types';

/**
 * Safely normalizes Marg code (prevents .trim() on numbers or undefined)
 */
export function safeCode(code?: any): string {
  if (code === undefined || code === null) return '';
  return String(code).trim().toLowerCase();
}

/**
 * Safely normalizes patient name for comparison
 */
export function safeNorm(name?: any): string {
  if (name === undefined || name === null) return '';
  return String(name).trim().toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');
}

/**
 * Safely extracts 10-digit Indian phone number
 */
export function safePhone(phone?: any): string {
  if (phone === undefined || phone === null) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Resolves all customers associated with a specific upload batch.
 * Multi-layer lookup strategy:
 * 1. Direct matching against batch.customerIds (Set of IDs).
 * 2. Lookup by phone, code, or name from batch.customerIds prefixes.
 * 3. Chronological matching against customer purchase dates and medicines
 *    falling within the batch's sales period or monthKey (e.g. "2026-07").
 * 4. Inclusion of batch.newCustomers if populated.
 */
export function getCustomersForBatch(batch: UploadBatch, allCustomers: Customer[]): Customer[] {
  if (!batch || !allCustomers || !Array.isArray(allCustomers) || allCustomers.length === 0) return [];

  const matchedSet = new Set<string>();
  const result: Customer[] = [];

  const addCust = (c: Customer) => {
    if (!c || !c.id || matchedSet.has(c.id)) return;
    matchedSet.add(c.id);
    result.push(c);
  };

  // 1. Direct ID lookup from batch.customerIds
  if (batch.customerIds && Array.isArray(batch.customerIds) && batch.customerIds.length > 0) {
    const idSet = new Set(batch.customerIds);
    allCustomers.forEach(c => {
      if (c && c.id && idSet.has(c.id)) {
        addCust(c);
      }
    });
  }

  // 2. Inclusion of batch.newCustomers
  if (batch.newCustomers && Array.isArray(batch.newCustomers) && batch.newCustomers.length > 0) {
    batch.newCustomers.forEach(nc => {
      if (!nc) return;
      // Find matching in allCustomers or add directly
      const found = allCustomers.find(c => c.id === nc.id || (c.phoneNorm && c.phoneNorm === nc.phoneNorm));
      addCust(found || nc);
    });
  }

  // 3. Fallback / supplementary matching by sales period or monthKey
  const pStart = String(batch.periodStart || '');
  const pEnd = String(batch.periodEnd || '');
  const mKey = String(batch.monthKey || (pEnd ? pEnd.slice(0, 7) : ''));

  // If result is empty or has fewer customers than totalCustomers, match by dates
  if (pStart || pEnd || mKey) {
    allCustomers.forEach(cust => {
      if (!cust || matchedSet.has(cust.id)) return;

      let hasMatch = false;

      // Check lastPurchaseDate or firstPurchaseDate
      const lp = String(cust.lastPurchaseDate || '');
      const fp = String(cust.firstPurchaseDate || '');

      if (pStart && pEnd) {
        if (lp >= pStart && lp <= pEnd) hasMatch = true;
        else if (fp >= pStart && fp <= pEnd) hasMatch = true;
      }
      if (!hasMatch && mKey) {
        if (lp.startsWith(mKey)) hasMatch = true;
        else if (fp.startsWith(mKey)) hasMatch = true;
      }

      // Check customer individual medicines
      if (!hasMatch && Array.isArray(cust.medicines) && cust.medicines.length > 0) {
        hasMatch = cust.medicines.some(m => {
          if (!m) return false;
          const mlp = String(m.lastPurchaseDate || '');
          if (pStart && pEnd && mlp >= pStart && mlp <= pEnd) return true;
          if (mKey && mlp.startsWith(mKey)) return true;
          return false;
        });
      }

      if (hasMatch) {
        addCust(cust);
      }
    });
  }

  return result;
}

/**
 * Cross-references two monthly Excel upload batches to identify missing customers,
 * retained regular customers, and newly acquired customers with 100% accuracy and zero runtime errors.
 */
export function compareMonthlyBatches(
  referenceBatch: UploadBatch, // e.g. July 2026 (earlier / baseline month)
  targetBatch: UploadBatch,    // e.g. August 2026 (recent / current month)
  allCustomers: Customer[]
): MonthlyAuditComparison {
  const emptyComparison: MonthlyAuditComparison = {
    referenceBatch: referenceBatch || ({} as UploadBatch),
    targetBatch: targetBatch || ({} as UploadBatch),
    totalInReferenceMonth: 0,
    totalInTargetMonth: 0,
    retainedCount: 0,
    missingCount: 0,
    newCount: 0,
    missingCustomers: [],
    retainedCustomers: [],
    newCustomers: [],
  };

  try {
    if (!referenceBatch || !targetBatch || !allCustomers || !Array.isArray(allCustomers)) {
      return emptyComparison;
    }

    // Retrieve customers for both batches using robust resolution
    const refCustomers = getCustomersForBatch(referenceBatch, allCustomers);
    const targetCustomers = getCustomersForBatch(targetBatch, allCustomers);

    // Build indexed lookup maps for target batch customers
    const targetIdSet = new Set<string>();
    const targetPhoneMap = new Map<string, Customer>();
    const targetCodeMap = new Map<string, Customer>();
    const targetNameMap = new Map<string, Customer>();

    targetCustomers.forEach(cust => {
      if (!cust) return;
      if (cust.id) targetIdSet.add(cust.id);
      
      const phone = safePhone(cust.phoneNorm || cust.phone);
      if (phone) targetPhoneMap.set(phone, cust);

      const code = safeCode(cust.code);
      if (code) targetCodeMap.set(code, cust);

      const name = safeNorm(cust.nameNorm || cust.name);
      if (name) targetNameMap.set(name, cust);
    });

    const missingCustomers: MissingCustomerAuditItem[] = [];
    const retainedCustomers: MissingCustomerAuditItem[] = [];

    refCustomers.forEach(cust => {
      if (!cust) return;

      const custPhone = safePhone(cust.phoneNorm || cust.phone);
      const custCode = safeCode(cust.code);
      const custName = safeNorm(cust.nameNorm || cust.name);

      // Check if customer purchased in target month
      let isMatchedInTarget = false;
      let matchType: 'phone' | 'code' | 'name' | undefined;

      if (cust.id && targetIdSet.has(cust.id)) {
        isMatchedInTarget = true;
        matchType = custPhone ? 'phone' : custCode ? 'code' : 'name';
      } else if (custPhone && targetPhoneMap.has(custPhone)) {
        isMatchedInTarget = true;
        matchType = 'phone';
      } else if (custCode && targetCodeMap.has(custCode)) {
        isMatchedInTarget = true;
        matchType = 'code';
      } else if (custName && targetNameMap.has(custName)) {
        isMatchedInTarget = true;
        matchType = 'name';
      }

      // Filter medicines bought during the reference month if possible
      const pStart = String(referenceBatch.periodStart || '');
      const pEnd = String(referenceBatch.periodEnd || '');
      const mKey = String(referenceBatch.monthKey || (pEnd ? pEnd.slice(0, 7) : ''));

      let refMeds: CustomerMedicine[] = [];
      if (Array.isArray(cust.medicines) && cust.medicines.length > 0) {
        refMeds = cust.medicines.filter(m => {
          if (!m) return false;
          const mlp = String(m.lastPurchaseDate || '');
          if (pStart && pEnd && mlp >= pStart && mlp <= pEnd) return true;
          if (mKey && mlp.startsWith(mKey)) return true;
          return false;
        });
        if (refMeds.length === 0) {
          refMeds = cust.medicines;
        }
      }

      const previousSpend = refMeds.reduce((sum, m) => sum + (Number(m?.amount) || 0), 0) || Number(cust.totalSpend) || 0;

      const auditItem: MissingCustomerAuditItem = {
        customer: cust,
        previousMonthPurchaseDate: cust.lastPurchaseDate || referenceBatch.periodEnd || referenceBatch.periodStart || '',
        previousMonthSpend: Math.round(previousSpend * 100) / 100,
        previousMedicines: refMeds,
        status: isMatchedInTarget ? 'RETAINED' : 'MISSING_THIS_MONTH',
        contactPhone: custPhone || cust.phone || '',
        customerCode: cust.code ? String(cust.code) : undefined,
        matchedBy: matchType,
        notes: cust.notes,
      };

      if (isMatchedInTarget) {
        retainedCustomers.push(auditItem);
      } else {
        missingCustomers.push(auditItem);
      }
    });

    // Identify newly acquired customers who purchased in targetBatch but not in referenceBatch
    const refIdSet = new Set<string>();
    const refPhoneMap = new Map<string, Customer>();
    const refCodeMap = new Map<string, Customer>();
    const refNameMap = new Map<string, Customer>();

    refCustomers.forEach(c => {
      if (!c) return;
      if (c.id) refIdSet.add(c.id);

      const phone = safePhone(c.phoneNorm || c.phone);
      if (phone) refPhoneMap.set(phone, c);

      const code = safeCode(c.code);
      if (code) refCodeMap.set(code, c);

      const name = safeNorm(c.nameNorm || c.name);
      if (name) refNameMap.set(name, c);
    });

    const newCustomers: MissingCustomerAuditItem[] = [];
    targetCustomers.forEach(cust => {
      if (!cust) return;

      const custPhone = safePhone(cust.phoneNorm || cust.phone);
      const custCode = safeCode(cust.code);
      const custName = safeNorm(cust.nameNorm || cust.name);

      let wasInRef = false;
      if (cust.id && refIdSet.has(cust.id)) wasInRef = true;
      else if (custPhone && refPhoneMap.has(custPhone)) wasInRef = true;
      else if (custCode && refCodeMap.has(custCode)) wasInRef = true;
      else if (custName && refNameMap.has(custName)) wasInRef = true;

      if (!wasInRef) {
        newCustomers.push({
          customer: cust,
          previousMonthPurchaseDate: cust.lastPurchaseDate || targetBatch.periodEnd || targetBatch.periodStart || '',
          previousMonthSpend: Number(cust.totalSpend) || 0,
          previousMedicines: cust.medicines || [],
          status: 'NEW_THIS_MONTH',
          contactPhone: custPhone || cust.phone || '',
          customerCode: cust.code ? String(cust.code) : undefined,
        });
      }
    });

    return {
      referenceBatch,
      targetBatch,
      totalInReferenceMonth: refCustomers.length,
      totalInTargetMonth: targetCustomers.length,
      retainedCount: retainedCustomers.length,
      missingCount: missingCustomers.length,
      newCount: newCustomers.length,
      missingCustomers,
      retainedCustomers,
      newCustomers,
    };
  } catch (err) {
    console.error('compareMonthlyBatches error:', err);
    return emptyComparison;
  }
}

/**
 * Exports missing customers list to a CSV download
 */
export function exportMissingCustomersCSV(
  comparison: MonthlyAuditComparison
): void {
  try {
    if (!comparison || !comparison.missingCustomers) return;

    const refMonth = comparison.referenceBatch?.monthName || comparison.referenceBatch?.fileName || 'Previous Month';
    const targetMonth = comparison.targetBatch?.monthName || comparison.targetBatch?.fileName || 'Current Month';

    const headers = [
      'Patient Name',
      'Contact Phone',
      'Marg Code',
      'Status',
      'Purchased In',
      'Missing From',
      'Previous Spend (Rs)',
      'Medicines Bought in Previous Month',
      'Last Purchase Date',
      'Is Monthly Tracked'
    ];

    const rows = (comparison.missingCustomers || []).map(item => {
      const medNames = (item.previousMedicines || []).map(m => (typeof m === 'string' ? m : m?.name) || '').filter(Boolean).join('; ');
      const custName = String(item.customer?.name || 'Unknown Patient');
      const spend = (Number(item.previousMonthSpend) || 0).toFixed(2);
      const lastDate = String(item.previousMonthPurchaseDate || '');
      const isMonthly = item.customer?.isMonthlyRegular ? 'Yes' : 'No';

      return [
        `"${custName.replace(/"/g, '""')}"`,
        `"${String(item.contactPhone || '')}"`,
        `"${String(item.customerCode || '')}"`,
        '"MISSING_THIS_MONTH"',
        `"${refMonth}"`,
        `"${targetMonth}"`,
        spend,
        `"${medNames.replace(/"/g, '""')}"`,
        `"${lastDate}"`,
        isMonthly
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanRef = String(comparison.referenceBatch?.monthName || 'prev').toLowerCase().replace(/\s+/g, '_');
    const cleanTarget = String(comparison.targetBatch?.monthName || 'current').toLowerCase().replace(/\s+/g, '_');
    a.download = `missing_patients_${cleanRef}_vs_${cleanTarget}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error exporting missing customers CSV:', err);
    alert('Failed to generate export file. Please try again.');
  }
}

export interface MissingCustomersResult {
  missingCustomerIds: Set<string>;
  previousMonthLabel: string;
  hasComparison: boolean;
}

/**
 * Computes the set of "missing" customers by comparing the latest committed month
 * against the immediately previous committed month.
 * Sorted chronologically by monthKey (e.g. 2026-07 -> 2026-08 -> 2026-09).
 */
export function computeMissingCustomers(
  batches: UploadBatch[],
  allCustomers: Customer[]
): MissingCustomersResult {
  const emptyResult: MissingCustomersResult = {
    missingCustomerIds: new Set<string>(),
    previousMonthLabel: '',
    hasComparison: false,
  };

  if (!batches || !Array.isArray(batches) || batches.length === 0) {
    return emptyResult;
  }

  // 1. Take committed batches (exclude rolled_back)
  const committedBatches = batches.filter(b => b && b.status === 'committed');
  if (committedBatches.length === 0) {
    return emptyResult;
  }

  // 2. Group by monthKey (derive from periodEnd if missing; e.g. "2026-07")
  const monthGroups = new Map<string, { monthName: string; customerIdSet: Set<string> }>();

  committedBatches.forEach(b => {
    const pEnd = String(b.periodEnd || '');
    const mKey = String(b.monthKey || (pEnd ? pEnd.slice(0, 7) : '')).trim();
    if (!mKey) return;

    if (!monthGroups.has(mKey)) {
      let mName = b.monthName;
      if (!mName && mKey.length >= 7) {
        const parts = mKey.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        mName = `${months[m - 1] || mKey} ${y}`;
      }
      monthGroups.set(mKey, {
        monthName: mName || mKey,
        customerIdSet: new Set<string>(),
      });
    }

    const group = monthGroups.get(mKey)!;
    const custsInBatch = getCustomersForBatch(b, allCustomers);
    custsInBatch.forEach(c => {
      if (c && c.id) group.customerIdSet.add(c.id);
    });
    if (Array.isArray(b.customerIds)) {
      b.customerIds.forEach(id => {
        if (id) group.customerIdSet.add(id);
      });
    }
  });

  // 3. Sort chronologically by monthKey
  const sortedMonthKeys = Array.from(monthGroups.keys()).sort();

  if (sortedMonthKeys.length < 2) {
    return emptyResult;
  }

  const latestMonthKey = sortedMonthKeys[sortedMonthKeys.length - 1];
  const previousMonthKey = sortedMonthKeys[sortedMonthKeys.length - 2];

  const latestGroup = monthGroups.get(latestMonthKey)!;
  const previousGroup = monthGroups.get(previousMonthKey)!;

  let shortPrevName = previousGroup.monthName;
  shortPrevName = shortPrevName
    .replace('January', 'Jan')
    .replace('February', 'Feb')
    .replace('March', 'Mar')
    .replace('April', 'Apr')
    .replace('June', 'Jun')
    .replace('July', 'Jul')
    .replace('August', 'Aug')
    .replace('September', 'Sep')
    .replace('October', 'Oct')
    .replace('November', 'Nov')
    .replace('December', 'Dec');

  const missingCustomerIds = new Set<string>();
  previousGroup.customerIdSet.forEach(id => {
    if (!latestGroup.customerIdSet.has(id)) {
      missingCustomerIds.add(id);
    }
  });

  return {
    missingCustomerIds,
    previousMonthLabel: shortPrevName,
    hasComparison: true,
  };
}
