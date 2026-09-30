import * as XLSX from 'xlsx';
import type { Customer, CustomerMedicine, PurchaseRecord } from '@/types';

export interface ParsedMargBatch {
  fileName: string;
  originalFileName?: string;
  monthName?: string;
  monthKey?: string;
  fileSize: number;
  periodStart: string;
  periodEnd: string;
  formatType: 'MARG_GROUPED_SUMMARY' | 'TABULAR_SALES_REGISTER';
  customers: Customer[];
  totalRowsProcessed: number;
  totalMedicinesCount: number;
}

/**
 * Derives month name, key, and formatted file name from dates or file name.
 * e.g. July 2026 Sales Report (jully26.XLS) with monthKey "2026-07"
 */
export function deriveMonthInfo(periodStart?: string, periodEnd?: string, originalFileName: string = ''): {
  monthName: string;
  monthKey: string;
  formattedFileName: string;
  originalFileName: string;
} {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const baseClean = originalFileName ? originalFileName.replace(/[<>:"/\\|?*]/g, '_') : 'sales_export.xls';

  // 1. Try date from periodEnd or periodStart
  const refDateStr = periodEnd || periodStart;
  if (refDateStr) {
    const d = new Date(refDateStr);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      const mName = `${months[monthIdx]} ${year}`;
      const mKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      return {
        monthName: mName,
        monthKey: mKey,
        formattedFileName: `${mName} Sales Report (${baseClean})`,
        originalFileName,
      };
    }
  }

  // 2. Fallback: Parse from fileName (e.g. jully26, aug26, etc.)
  const lowerName = originalFileName.toLowerCase();
  const monthAbbrs: [string, number][] = [
    ['jan', 0], ['feb', 1], ['mar', 2], ['apr', 3], ['may', 4], ['jun', 5],
    ['jully', 6], ['jul', 6], ['aug', 7], ['sep', 8], ['sept', 8], ['oct', 9], ['nov', 10], ['dec', 11]
  ];
  for (const [abbr, idx] of monthAbbrs) {
    if (lowerName.includes(abbr)) {
      const yearMatch = lowerName.match(/(20\d{2}|\d{2})/);
      let year = new Date().getFullYear();
      if (yearMatch) {
        year = yearMatch[1].length === 2 ? 2000 + parseInt(yearMatch[1], 10) : parseInt(yearMatch[1], 10);
      }
      const mName = `${months[idx]} ${year}`;
      const mKey = `${year}-${String(idx + 1).padStart(2, '0')}`;
      return {
        monthName: mName,
        monthKey: mKey,
        formattedFileName: `${mName} Sales Report (${baseClean})`,
        originalFileName,
      };
    }
  }

  // 3. Current month default
  const now = new Date();
  const mName = `${months[now.getMonth()]} ${now.getFullYear()}`;
  const mKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    monthName: mName,
    monthKey: mKey,
    formattedFileName: `${mName} Sales Report (${baseClean})`,
    originalFileName,
  };
}

/**
 * Normalizes phone numbers to 10 digits
 */
export function normalizePhone(raw?: string | number | null): string | undefined {
  if (!raw) return undefined;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length >= 10) return digits.slice(-10);
  return undefined;
}

/**
 * Normalizes customer or medicine names for fuzzy deduplication
 */
export function normalizeName(name?: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates a 100% deterministic unique customer ID based on phone, code, or name.
 * Prevents duplicate customer document creation across repeated uploads or cloud syncs.
 */
export function generateDeterministicCustomerId(phoneNorm?: string, code?: string, nameNorm?: string): string {
  if (phoneNorm && phoneNorm.length >= 10) {
    return 'cust_p_' + phoneNorm.slice(-10);
  }
  if (code && code.trim().length > 0) {
    return 'cust_c_' + code.trim().toLowerCase().replace(/[^\w]/g, '');
  }
  const cleanName = (nameNorm || 'unknown').toLowerCase().replace(/[^\w]/g, '_').slice(0, 32);
  return 'cust_n_' + cleanName;
}

/**
 * Parses Indian DD/MM/YYYY date strings into ISO YYYY-MM-DD
 */
export function parseDateToISO(dateStr?: string | null, fallbackISO: string = new Date().toISOString().split('T')[0]): string {
  if (!dateStr) return fallbackISO;
  const match = String(dateStr).trim().match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  // Try standard ISO or new Date
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return fallbackISO;
}

/**
 * Calculates due date given a purchase date and cycle in days
 */
export function computeDueDate(purchaseDateISO: string, cycleDays: number = 30): string {
  const d = new Date(purchaseDateISO);
  if (isNaN(d.getTime())) return purchaseDateISO;
  d.setDate(d.getDate() + cycleDays);
  return d.toISOString().split('T')[0];
}

/**
 * Calculates alert date (5 days before due date)
 */
export function computeAlertDate(dueDateISO: string, alertDaysBefore: number = 5): string {
  const d = new Date(dueDateISO);
  if (isNaN(d.getTime())) return dueDateISO;
  d.setDate(d.getDate() - alertDaysBefore);
  return d.toISOString().split('T')[0];
}

/**
 * Parses Marg ERP Grouped Report or Tabular Excel/CSV workbook
 */
export function parseMargExcel(
  fileBuffer: ArrayBuffer | Uint8Array,
  fileName: string = 'export.xls',
  defaultRefillCycleDays: number = 30,
  alertDaysBefore: number = 5
): ParsedMargBatch {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // 1. Detect if this is Marg Grouped Report (PATIENT/PRODUCT WISE SALES SUMMARY)
  let isGroupedReport = false;
  let periodStart = '';
  let periodEnd = '';

  for (let r = 0; r < Math.min(15, rows.length); r++) {
    const text = String(rows[r]?.[0] || '');
    if (text.includes('PATIENT/PRODUCT WISE SALES SUMMARY') || text.includes('SARITA PHARMACY')) {
      isGroupedReport = true;
    }
    const rangeMatch = text.match(/FROM\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+TO\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (rangeMatch) {
      periodStart = parseDateToISO(rangeMatch[1]);
      periodEnd = parseDateToISO(rangeMatch[2]);
      break;
    }
    const singleMatch = text.match(/(?:DATE|DT|AS ON|ON)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (singleMatch && !periodEnd) {
      periodStart = parseDateToISO(singleMatch[1]);
      periodEnd = periodStart;
    }
  }

  // Fallback 1: Extract date from fileName (e.g. 05-09-2026.xls, 05_09.xls, 2026-09-05.xlsx)
  if (!periodEnd && fileName) {
    const isoMatch = fileName.match(/(20\d{2})[\-_](\d{1,2})[\-_](\d{1,2})/);
    if (isoMatch) {
      const parsed = `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
      periodStart = parsed;
      periodEnd = parsed;
    } else {
      const dmyMatch = fileName.match(/(\d{1,2})[\-_](\d{1,2})[\-_](20\d{2}|\d{2})/);
      if (dmyMatch) {
        const yr = dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3];
        const parsed = `${yr}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
        periodStart = parsed;
        periodEnd = parsed;
      } else {
        const dmMatch = fileName.match(/(\d{1,2})[\-_](\d{1,2})(?:\.|$)/);
        if (dmMatch) {
          const currentYear = new Date().getFullYear();
          const parsed = `${currentYear}-${dmMatch[2].padStart(2, '0')}-${dmMatch[1].padStart(2, '0')}`;
          periodStart = parsed;
          periodEnd = parsed;
        }
      }
    }
  }

  // Fallback 2: Default to today if date could not be determined
  const todayISO = new Date().toISOString().split('T')[0];
  if (!periodEnd) periodEnd = todayISO;
  if (!periodStart) {
    const d = new Date(periodEnd);
    d.setDate(d.getDate() - 30);
    periodStart = d.toISOString().split('T')[0];
  }

  const monthInfo = deriveMonthInfo(periodStart, periodEnd, fileName);

  if (isGroupedReport) {
    return parseGroupedMargReport(rows, monthInfo, fileBuffer.byteLength, periodStart, periodEnd, defaultRefillCycleDays, alertDaysBefore);
  } else {
    return parseTabularSalesReport(rows, monthInfo, fileBuffer.byteLength, periodStart, periodEnd, defaultRefillCycleDays, alertDaysBefore);
  }
}

/**
 * Parser for Marg ERP "PATIENT/PRODUCT WISE SALES SUMMARY"
 */
function parseGroupedMargReport(
  rows: unknown[][],
  monthInfo: ReturnType<typeof deriveMonthInfo>,
  fileSize: number,
  periodStart: string,
  periodEnd: string,
  defaultCycleDays: number,
  alertDaysBefore: number
): ParsedMargBatch {
  const customers: Customer[] = [];
  let currentCust: Partial<Customer> | null = null;
  let currentMeds: CustomerMedicine[] = [];
  let totalMedicinesCount = 0;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const s0 = String(row[0] != null ? row[0] : '').trim();

    // Skip layout headers, titles, and pagination rows
    if (
      !s0 ||
      s0 === 'SARITA PHARMACY' ||
      s0.startsWith('PATIENT/PRODUCT') ||
      s0.startsWith('Phone :') ||
      s0.startsWith('5/1/1') ||
      s0.startsWith('SNO.') ||
      s0.startsWith('SUB TOTAL') ||
      s0 === 'TOTAL' ||
      s0.startsWith('TOTAL') ||
      s0.startsWith('MARG ERP') ||
      s0.startsWith('Continued..') ||
      s0.startsWith('Page')
    ) {
      continue;
    }

    // Skip top headerless serial block (e.g. standalone "1" at top with unassigned sales)
    if (s0 === '1' && r < 10) {
      if (currentCust && currentMeds.length > 0) {
        finalizeAndPushCustomer(customers, currentCust, currentMeds, periodEnd, defaultCycleDays, alertDaysBefore);
      }
      currentCust = null;
      currentMeds = [];
      continue;
    }

    // Skip CASH counter sale blocks (e.g. "121. .          CASH" or any line with CASH)
    if (s0.toUpperCase().includes('CASH')) {
      if (currentCust && currentMeds.length > 0) {
        finalizeAndPushCustomer(customers, currentCust, currentMeds, periodEnd, defaultCycleDays, alertDaysBefore);
      }
      currentCust = null;
      currentMeds = [];
      continue;
    }

    // Customer Header Matchers:
    // Case 1: "84.  0006       NITI RANI KHESARI", "148. 2  DR.VARUN TRIPATHI", or "456. 9936199660 MADHU PANDEY"
    const custMatch = s0.match(/^(\d+)\.\s+([A-Za-z0-9]{1,12})\s+(.+)$/);
    // Case 2: "12.  RAMESH KUMAR" (name without code)
    const custMatchNoCode = s0.match(/^(\d+)\.\s+([A-Za-z].+)$/);

    if (custMatch || custMatchNoCode) {
      // Save previous customer if exists
      if (currentCust && currentMeds.length > 0) {
        finalizeAndPushCustomer(customers, currentCust, currentMeds, periodEnd, defaultCycleDays, alertDaysBefore);
      }

      let codeOrPhone = '';
      let rawName = '';
      if (custMatch) {
        codeOrPhone = custMatch[2].trim();
        rawName = custMatch[3].trim();
      } else if (custMatchNoCode) {
        rawName = custMatchNoCode[2].trim();
      }

      const phoneNorm = normalizePhone(codeOrPhone);
      const isActualPhone = phoneNorm !== undefined && /^[6-9]\d{9}$/.test(phoneNorm);

      currentMeds = [];
      currentCust = {
        id: generateDeterministicCustomerId(phoneNorm, isActualPhone ? undefined : codeOrPhone, normalizeName(rawName)),
        name: rawName,
        nameNorm: normalizeName(rawName),
        phone: isActualPhone ? phoneNorm : undefined,
        phoneNorm: isActualPhone ? phoneNorm : undefined,
        code: !isActualPhone && codeOrPhone ? codeOrPhone : undefined,
        totalPurchases: 1,
        totalSpend: 0,
        monthsActive: 1,
        status: 'active',
        firstPurchaseDate: periodStart,
        lastPurchaseDate: periodEnd,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      continue;
    }

    // Medicine Row under current customer:
    // e.g. ["    CYBLEX M XR 60 TAB             1*15TAB", "6:0 STRP", 1224.2]
    if (currentCust && s0.length > 0) {
      const qtyUnitRaw = row[1] != null ? String(row[1]).trim() : '';
      const amountVal = typeof row[2] === 'number' ? row[2] : parseFloat(String(row[2] || '0').replace(/,/g, ''));

      if (qtyUnitRaw && !isNaN(amountVal)) {
        totalMedicinesCount++;

        // Split item name and pack size if formatted like: "CYBLEX M XR 60 TAB             1*15TAB"
        let medName = s0;
        let packaging = '';
        const packMatch = s0.match(/^(.*?)\s{2,}([\d\*]+[A-Za-z0-9]+)$/);
        if (packMatch) {
          medName = packMatch[1].trim();
          packaging = packMatch[2].trim();
        }

        // Parse quantity e.g. "6:0 STRP" -> 6 strips
        let qty = 1;
        const qMatch = qtyUnitRaw.match(/^([\d\.\-]+)/);
        if (qMatch) {
          const parsedQ = parseFloat(qMatch[1].replace(':', '.'));
          if (!isNaN(parsedQ) && parsedQ > 0) qty = parsedQ;
        }

        const medDueDate = computeDueDate(periodEnd, defaultCycleDays);

        currentMeds.push({
          id: 'med_' + normalizeName(medName) + '_' + currentMeds.length,
          name: medName,
          nameNorm: normalizeName(medName),
          packaging: packaging || undefined,
          qty,
          unit: qtyUnitRaw,
          amount: amountVal,
          refillCycleDays: defaultCycleDays,
          lastPurchaseDate: periodEnd,
          nextDueDate: medDueDate,
          status: 'regular',
        });
      }
    }
  }

  // Finalize last customer in file
  if (currentCust && currentMeds.length > 0) {
    finalizeAndPushCustomer(customers, currentCust, currentMeds, periodEnd, defaultCycleDays, alertDaysBefore);
  }

  return {
    fileName: monthInfo.formattedFileName,
    originalFileName: monthInfo.originalFileName,
    monthName: monthInfo.monthName,
    monthKey: monthInfo.monthKey,
    fileSize,
    periodStart,
    periodEnd,
    formatType: 'MARG_GROUPED_SUMMARY',
    customers,
    totalRowsProcessed: rows.length,
    totalMedicinesCount,
  };
}

/**
 * Parser for standard Tabular Marg Sales Register / Excel export
 */
function parseTabularSalesReport(
  rows: unknown[][],
  monthInfo: ReturnType<typeof deriveMonthInfo>,
  fileSize: number,
  periodStart: string,
  periodEnd: string,
  defaultCycleDays: number,
  alertDaysBefore: number
): ParsedMargBatch {
  if (rows.length === 0) {
    return {
      fileName: monthInfo.formattedFileName,
      originalFileName: monthInfo.originalFileName,
      monthName: monthInfo.monthName,
      monthKey: monthInfo.monthKey,
      fileSize,
      periodStart,
      periodEnd,
      formatType: 'TABULAR_SALES_REGISTER',
      customers: [],
      totalRowsProcessed: 0,
      totalMedicinesCount: 0,
    };
  }

  // Find header row index
  let headerRowIdx = -1;
  let colIdx = {
    date: -1,
    billNo: -1,
    customer: -1,
    phone: -1,
    item: -1,
    qty: -1,
    amount: -1,
    doctor: -1,
  };

  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || '').toLowerCase().trim();
      if (val.includes('date')) colIdx.date = c;
      else if (val.includes('bill') || val.includes('inv')) colIdx.billNo = c;
      else if (val.includes('party') || val.includes('customer') || val.includes('patient') || val.includes('name')) {
        if (!val.includes('item') && !val.includes('med')) colIdx.customer = c;
      } else if (val.includes('mobile') || val.includes('phone') || val.includes('contact')) colIdx.phone = c;
      else if (val.includes('item') || val.includes('medicine') || val.includes('product') || val.includes('description')) colIdx.item = c;
      else if (val.includes('qty') || val.includes('quantity')) colIdx.qty = c;
      else if (val.includes('amount') || val.includes('total') || val.includes('net')) colIdx.amount = c;
      else if (val.includes('doctor') || val.includes('dr.')) colIdx.doctor = c;
    }
    if (colIdx.customer !== -1 && (colIdx.item !== -1 || colIdx.amount !== -1)) {
      headerRowIdx = r;
      break;
    }
  }

  const customerMap = new Map<string, { cust: Partial<Customer>; meds: CustomerMedicine[]; history: PurchaseRecord[] }>();
  let totalMedicinesCount = 0;

  const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 1;
  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rawName = colIdx.customer !== -1 ? String(row[colIdx.customer] || '').trim() : '';
    if (!rawName) continue;

    const rawPhone = colIdx.phone !== -1 ? String(row[colIdx.phone] || '') : '';
    const phoneNorm = normalizePhone(rawPhone);
    const rawItem = colIdx.item !== -1 ? String(row[colIdx.item] || '').trim() : 'General Medicine';
    const rawQty = colIdx.qty !== -1 ? parseFloat(String(row[colIdx.qty] || '1')) : 1;
    const rawAmount = colIdx.amount !== -1 ? parseFloat(String(row[colIdx.amount] || '0').replace(/,/g, '')) : 0;
    const rawDate = colIdx.date !== -1 ? parseDateToISO(String(row[colIdx.date] || ''), periodEnd) : periodEnd;
    const billNo = colIdx.billNo !== -1 ? String(row[colIdx.billNo] || '').trim() : undefined;
    const doctor = colIdx.doctor !== -1 ? String(row[colIdx.doctor] || '').trim() : undefined;

    const custKey = phoneNorm || normalizeName(rawName);
    if (!customerMap.has(custKey)) {
      customerMap.set(custKey, {
        cust: {
          id: generateDeterministicCustomerId(phoneNorm, undefined, normalizeName(rawName)),
          name: rawName,
          nameNorm: normalizeName(rawName),
          phone: phoneNorm,
          phoneNorm,
          status: 'active',
          firstPurchaseDate: rawDate,
          lastPurchaseDate: rawDate,
          totalPurchases: 1,
          totalSpend: 0,
          monthsActive: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        meds: [],
        history: [],
      });
    }

    const entry = customerMap.get(custKey)!;
    totalMedicinesCount++;

    const medDueDate = computeDueDate(rawDate, defaultCycleDays);
    entry.meds.push({
      id: 'med_' + normalizeName(rawItem) + '_' + entry.meds.length,
      name: rawItem,
      nameNorm: normalizeName(rawItem),
      qty: isNaN(rawQty) ? 1 : rawQty,
      amount: isNaN(rawAmount) ? 0 : rawAmount,
      refillCycleDays: defaultCycleDays,
      lastPurchaseDate: rawDate,
      nextDueDate: medDueDate,
      status: 'regular',
    });

    entry.history.push({
      id: 'pur_' + r,
      batchId: monthInfo.formattedFileName,
      billNo,
      date: rawDate,
      item: rawItem,
      qty: isNaN(rawQty) ? 1 : rawQty,
      amount: isNaN(rawAmount) ? 0 : rawAmount,
      doctor,
    });
  }

  const customers: Customer[] = [];
  customerMap.forEach(({ cust, meds, history }) => {
    finalizeAndPushCustomer(customers, cust, meds, periodEnd, defaultCycleDays, alertDaysBefore, history);
  });

  return {
    fileName: monthInfo.formattedFileName,
    originalFileName: monthInfo.originalFileName,
    monthName: monthInfo.monthName,
    monthKey: monthInfo.monthKey,
    fileSize,
    periodStart,
    periodEnd,
    formatType: 'TABULAR_SALES_REGISTER',
    customers,
    totalRowsProcessed: rows.length - startRow,
    totalMedicinesCount,
  };
}

function finalizeAndPushCustomer(
  customers: Customer[],
  custPartial: Partial<Customer>,
  meds: CustomerMedicine[],
  purchaseDateISO: string,
  defaultCycleDays: number,
  alertDaysBefore: number,
  history: PurchaseRecord[] = []
) {
  const totalSpend = meds.reduce((acc, m) => acc + (m.amount || 0), 0);
  const nextDueDate = computeDueDate(purchaseDateISO, defaultCycleDays);
  const alertDate = computeAlertDate(nextDueDate, alertDaysBefore);

  const customer: Customer = {
    id: custPartial.id || generateDeterministicCustomerId(custPartial.phoneNorm, custPartial.code, custPartial.nameNorm),
    name: custPartial.name || 'Unknown Patient',
    nameNorm: custPartial.nameNorm || normalizeName(custPartial.name),
    phone: custPartial.phone,
    phoneNorm: custPartial.phoneNorm,
    code: custPartial.code,
    address: custPartial.address,
    notes: custPartial.notes,
    isMonthlyRegular: false, // will be evaluated by CustomerMatcher
    regularityScore: 40,
    firstPurchaseDate: custPartial.firstPurchaseDate || purchaseDateISO,
    lastPurchaseDate: purchaseDateISO,
    nextDueDate,
    alertDate,
    totalPurchases: custPartial.totalPurchases || 1,
    totalSpend,
    monthsActive: 1,
    status: 'active',
    medicines: meds,
    history,
    createdAt: custPartial.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  customers.push(customer);
}
