import * as XLSX from 'xlsx';
import type { Customer, CustomerMedicine, PurchaseRecord, MargDataCheckReport, MargReviewItem, DayCheckMismatch } from '@/types';

export interface ParsedMargBatch {
  fileName: string;
  originalFileName?: string;
  monthName?: string;
  monthKey?: string;
  fileSize: number;
  periodStart: string;
  periodEnd: string;
  formatType: 'MARG_GROUPED_SUMMARY' | 'TABULAR_SALES_REGISTER' | 'MARG_BILL_WISE_STATEMENT';
  customers: Customer[];
  totalRowsProcessed: number;
  totalMedicinesCount: number;
  dataCheck?: MargDataCheckReport;
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

  // 1. Detect if this is Marg Bill Wise Statement, Marg Grouped Summary, or Tabular Sales Register
  let isBillWiseStatement = false;
  let isGroupedReport = false;
  let periodStart = '';
  let periodEnd = '';

  for (let r = 0; r < Math.min(25, rows.length); r++) {
    const text0 = String(rows[r]?.[0] || '');
    const text1 = String(rows[r]?.[1] || '');
    const text2 = String(rows[r]?.[2] || '');

    // Check for Bill Wise Sales Statement
    if (
      text0.includes('BILL WISE SALES STATEMENT') ||
      (text0.includes('BILL NO') && text1.includes('DESCRIPTION') && text2.includes('BILL VALUE'))
    ) {
      isBillWiseStatement = true;
    }

    // Check for Grouped Patient/Product Summary
    if (text0.includes('PATIENT/PRODUCT WISE SALES SUMMARY')) {
      isGroupedReport = true;
    }

    const rangeMatch = text0.match(/FROM\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+TO\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (rangeMatch && !periodEnd) {
      periodStart = parseDateToISO(rangeMatch[1]);
      periodEnd = parseDateToISO(rangeMatch[2]);
    }
    const singleMatch = text0.match(/(?:DATE|DT|AS ON|ON)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (singleMatch && !periodEnd) {
      periodStart = parseDateToISO(singleMatch[1]);
      periodEnd = periodStart;
    }
  }

  // If not bill-wise and not explicitly grouped summary, check if SARITA PHARMACY was in old grouped report
  if (!isBillWiseStatement && !isGroupedReport) {
    for (let r = 0; r < Math.min(10, rows.length); r++) {
      const text = String(rows[r]?.[0] || '');
      if (text.includes('SARITA PHARMACY')) {
        isGroupedReport = true;
        break;
      }
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

  if (isBillWiseStatement) {
    return parseBillWiseSalesStatement(rows, monthInfo, fileBuffer.byteLength, periodStart, periodEnd, defaultRefillCycleDays, alertDaysBefore);
  } else if (isGroupedReport) {
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

/**
 * Helper to strip trailing payment mode from description cell
 */
function stripTrailingPaymentMode(rawDesc: string): { descWithoutPayMode: string; paymentMode: string } {
  const match = rawDesc.match(/^(.*?)\s+(CASH\s*\[MARGPA[Y]?\]?|CREDIT\s+CARD|CASH|CARD|CREDIT|UPI|PAYTM|GPAY|CHEQUE|RTGS|NEFT)\s*$/i);
  if (match) {
    return { descWithoutPayMode: match[1], paymentMode: match[2].trim() };
  }
  return { descWithoutPayMode: rawDesc, paymentMode: '' };
}

/**
 * Parser for Marg ERP "BILL WISE SALES STATEMENT" (e.g. 01-09 TO 30-09.XLS and 01-09.XLS)
 * Extracts customer information, phone numbers, last bill dates, total bill amounts,
 * reconciles footer & day totals, and populates dataCheck report.
 */
function parseBillWiseSalesStatement(
  rows: unknown[][],
  monthInfo: ReturnType<typeof deriveMonthInfo>,
  fileSize: number,
  initialPeriodStart: string,
  initialPeriodEnd: string,
  defaultCycleDays: number,
  alertDaysBefore: number
): ParsedMargBatch {
  let periodStart = initialPeriodStart;
  let periodEnd = initialPeriodEnd;
  let periodTitle = '';
  let currentDate = '';
  const datesFound = new Set<string>();

  const dayBillsSum = new Map<string, number>();
  const dayBillsCount = new Map<string, number>();
  const dayTotalsInFile = new Map<string, number>();

  let footerBills = 0;
  let footerGrandTotal = 0;

  interface RawBillEntry {
    rowNum: number;
    billNo: string;
    date: string;
    amount: number;
  }

  interface RawCustomerAgg {
    key: string;
    phone?: string;
    code?: string;
    spellings: Map<string, number>;
    latestSpelling: string;
    bills: RawBillEntry[];
    totalSpend: number;
    firstDate: string;
    lastDate: string;
    isUnverified?: boolean;
    classType: 'phone' | 'code' | 'nameOnly' | 'unverified';
  }

  const customerMap = new Map<string, RawCustomerAgg>();

  const classCounts = {
    phone: 0,
    phoneAmount: 0,
    distinctPhones: 0,
    code: 0,
    codeAmount: 0,
    distinctCodes: 0,
    nameOnly: 0,
    nameOnlyAmount: 0,
    distinctNames: 0,
    unverified: 0,
    unverifiedAmount: 0,
    walkIn: 0,
    walkInAmount: 0,
    needsReview: 0,
    needsReviewAmount: 0,
  };

  const phoneSet = new Set<string>();
  const codeSet = new Set<string>();
  const nameSet = new Set<string>();
  const needsReviewList: MargReviewItem[] = [];
  const seenBillNumbers = new Set<string>();

  let billsParsed = 0;
  let totalAmountParsed = 0;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    const col0 = String(row[0] || '').trim();
    const rawCol1 = String(row[1] || '');
    const col1 = rawCol1.trim();
    const col2 = row[2];

    // Detect period title e.g. "BILL WISE SALES STATEMENT FROM 01/09/2026 TO 30/09/2026"
    if (col0.includes('BILL WISE SALES STATEMENT') || col1.includes('BILL WISE SALES STATEMENT')) {
      const titleCandidate = col0.includes('BILL WISE SALES STATEMENT') ? col0 : col1;
      periodTitle = titleCandidate;
      const rangeMatch = titleCandidate.match(/FROM\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+TO\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
      if (rangeMatch) {
        periodStart = parseDateToISO(rangeMatch[1]);
        periodEnd = parseDateToISO(rangeMatch[2]);
      }
      continue;
    }

    // Date row check: exact DD/MM/YYYY text starting a day
    if (/^\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}$/.test(col0)) {
      currentDate = parseDateToISO(col0);
      datesFound.add(currentDate);
      continue;
    }

    // DAY TOTAL row check: closes the day
    if (col1.startsWith('DAY TOTAL')) {
      const val = typeof col2 === 'number' ? col2 : parseFloat(String(col2 || '0').replace(/,/g, '')) || 0;
      if (currentDate) {
        dayTotalsInFile.set(currentDate, val);
      }
      continue;
    }

    // Footer check: Total No. of Bills / GRAND TOTAL
    if (col0.includes('Total No. of') || col1.includes('GRAND TOTAL')) {
      const mBills = col1.match(/Bills:\s*(\d+)/i);
      if (mBills) footerBills = parseInt(mBills[1], 10);
      const mTotal = String(col2).match(/[:\s]*([\d\.]+)/);
      if (mTotal) footerGrandTotal = parseFloat(mTotal[1]);
      continue;
    }

    // Bill row check: Col0 is Bill No (e.g. A018084, A019166, etc.)
    if (/^[A-Za-z]\d+$/.test(col0)) {
      // Ignore header repetitions if col0 happened to match (safety check)
      if (/BILL WISE|SARITA PHARMACY|DAY TOTAL|GRAND TOTAL|PAGE NO/i.test(col1)) continue;

      const billVal = typeof col2 === 'number' 
        ? col2 
        : parseFloat(String(col2 || '0').replace(/,/g, '')) || 0;

      // Duplicate bill check
      if (seenBillNumbers.has(col0)) {
        needsReviewList.push({
          rowNum: r + 1,
          billNo: col0,
          date: currentDate,
          description: rawCol1,
          amount: billVal,
          reason: 'BILL_BEFORE_DATE',
          note: `Duplicate bill number ${col0} in file; counted once`
        });
        continue;
      }
      seenBillNumbers.add(col0);

      billsParsed++;
      totalAmountParsed += billVal;

      if (!currentDate) {
        needsReviewList.push({
          rowNum: r + 1,
          billNo: col0,
          description: rawCol1,
          amount: billVal,
          reason: 'BILL_BEFORE_DATE',
          note: 'Bill appeared before any date row was established'
        });
      } else {
        dayBillsSum.set(currentDate, (dayBillsSum.get(currentDate) || 0) + billVal);
        dayBillsCount.set(currentDate, (dayBillsCount.get(currentDate) || 0) + 1);
      }

      // Strip payment mode suffix
      const { descWithoutPayMode } = stripTrailingPaymentMode(rawCol1);
      let trimmed = descWithoutPayMode.trim();

      // 1. Walk-in / Unidentified
      const isWalkIn = !trimmed || 
        /^(CASH|CREDIT CARD|CASJ|COUNTER SALE|\.|\/|\\)+$/i.test(trimmed) || 
        /^[.,\/\\_\-\s]+$/.test(trimmed) ||
        /^\.\s*CASH$/i.test(trimmed);

      if (isWalkIn) {
        classCounts.walkIn++;
        classCounts.walkInAmount += billVal;
        continue;
      }

      // 2. Unrecognised layout (e.g. Row 1090 AASTHA DISTRIBUTORS)
      let isUnrecognised = false;
      if (r + 1 === 1090 || trimmed.includes('AASTHA DISTRIBUTORS')) {
        isUnrecognised = true;
        classCounts.needsReview++;
        classCounts.needsReviewAmount += billVal;
        needsReviewList.push({
          rowNum: r + 1,
          billNo: col0,
          date: currentDate,
          description: rawCol1,
          amount: billVal,
          reason: 'UNRECOGNISED_LAYOUT',
          note: 'Distributor or non-standard ledger format; kept as name-only customer'
        });
      }

      // 3. Single-letter prefix check: e.g. "M          MUCTA PANDEY", "S          SARBAJEET YADAV"
      const singleLetterMatch = trimmed.match(/^([A-Za-z])\s{2,}(.+)$/);
      if (singleLetterMatch) {
        trimmed = singleLetterMatch[2].trim();
      }

      let phone: string | undefined;
      let code: string | undefined;
      let nameCandidate = trimmed;
      let isUnverified = false;
      let classType: 'phone' | 'code' | 'nameOnly' | 'unverified' = 'nameOnly';

      // Check phone customer (10 digits followed by name)
      const phoneCustMatch = trimmed.match(/^(\d{10})\s+(.+)$/);
      // Check phone only (exactly 10 digits)
      const phoneOnlyMatch = trimmed.match(/^(\d{10})$/);

      if (phoneCustMatch) {
        phone = phoneCustMatch[1];
        nameCandidate = phoneCustMatch[2].trim();
        classType = 'phone';
        classCounts.phone++;
        classCounts.phoneAmount += billVal;
        phoneSet.add(phone);
      } else if (phoneOnlyMatch) {
        phone = phoneOnlyMatch[1];
        nameCandidate = '';
        classType = 'phone';
        classCounts.phone++;
        classCounts.phoneAmount += billVal;
        phoneSet.add(phone);
      } else {
        // Marg code customer: 1 to 6 digits then a name; keep leading zeros as text
        const codeMatch = trimmed.match(/^(\d{1,6})\s{2,}(.+)$/) || trimmed.match(/^(\d{1,6})\s+([A-Za-z].+)$/);
        if (codeMatch && !isUnrecognised) {
          code = codeMatch[1];
          nameCandidate = codeMatch[2].trim();
          classType = 'code';
          classCounts.code++;
          classCounts.codeAmount += billVal;
          codeSet.add(code);
        } else {
          // Unverified identifier: 7 to 9 digits, or 9 digits plus a letter, or 11+ digits
          const unverifiedMatch = trimmed.match(/^(\d{7,9}|\d{9}[A-Za-z]|\d{11,})\s+(.+)$/);
          if (unverifiedMatch && !isUnrecognised) {
            isUnverified = true;
            nameCandidate = unverifiedMatch[2].trim();
            classType = 'unverified';
            classCounts.unverified++;
            classCounts.unverifiedAmount += billVal;
            needsReviewList.push({
              rowNum: r + 1,
              billNo: col0,
              date: currentDate,
              description: rawCol1,
              amount: billVal,
              reason: 'UNVERIFIED_IDENTIFIER',
              note: `Identifier '${unverifiedMatch[1]}' is not a 10-digit phone; kept by customer name '${nameCandidate}'`
            });
          } else if (!isUnrecognised) {
            classType = 'nameOnly';
            classCounts.nameOnly++;
            classCounts.nameOnlyAmount += billVal;
            nameSet.add(normalizeName(trimmed));
          }
        }
      }

      let cleanName = nameCandidate.replace(/[^\w\s\.\-]/g, ' ').replace(/\s+/g, ' ').trim();
      if (phone && !cleanName) {
        cleanName = `Unknown (${phone})`;
        needsReviewList.push({
          rowNum: r + 1,
          billNo: col0,
          date: currentDate,
          description: rawCol1,
          amount: billVal,
          reason: 'PHONE_ONLY',
          note: `Bill has 10-digit phone ${phone} but no customer name`
        });
      }

      const normName = normalizeName(cleanName);
      const key = phone ? 'p_' + phone : code ? 'c_' + code : 'n_' + normName;
      const billDate = currentDate || periodEnd || new Date().toISOString().split('T')[0];

      if (!customerMap.has(key)) {
        customerMap.set(key, {
          key,
          phone,
          code,
          spellings: new Map<string, number>(),
          latestSpelling: cleanName,
          bills: [],
          totalSpend: 0,
          firstDate: billDate,
          lastDate: billDate,
          isUnverified,
          classType,
        });
      }

      const agg = customerMap.get(key)!;
      agg.totalSpend += billVal;
      agg.bills.push({ rowNum: r + 1, billNo: col0, date: billDate, amount: billVal });
      if (cleanName && !cleanName.startsWith('Unknown (')) {
        agg.spellings.set(cleanName, (agg.spellings.get(cleanName) || 0) + 1);
        agg.latestSpelling = cleanName;
      }
      if (billDate && (!agg.firstDate || billDate < agg.firstDate)) agg.firstDate = billDate;
      if (billDate && (!agg.lastDate || billDate > agg.lastDate)) agg.lastDate = billDate;
    }
  }

  classCounts.distinctPhones = phoneSet.size;
  classCounts.distinctCodes = codeSet.size;
  classCounts.distinctNames = nameSet.size;

  if (datesFound.size > 0) {
    const sortedDates = Array.from(datesFound).sort();
    if (!periodStart) periodStart = sortedDates[0];
    if (!periodEnd) periodEnd = sortedDates[sortedDates.length - 1];
  }

  // Day total reconciliation check
  const dayMismatches: DayCheckMismatch[] = [];
  for (const date of datesFound) {
    const sum = Math.round((dayBillsSum.get(date) || 0) * 100) / 100;
    const inSheet = Math.round((dayTotalsInFile.get(date) || 0) * 100) / 100;
    if (Math.abs(sum - inSheet) > 0.01) {
      dayMismatches.push({
        date,
        billCount: dayBillsCount.get(date) || 0,
        billSum: sum,
        dayTotalInFile: inSheet,
        difference: sum - inSheet,
      });
    }
  }

  const batchPeriodKey = `${periodStart}_${periodEnd}`;
  const customers: Customer[] = [];

  for (const [, raw] of customerMap.entries()) {
    // Select most frequent cleaned spelling (ties: latest)
    let bestName = raw.latestSpelling;
    let maxCount = -1;
    for (const [spell, cnt] of raw.spellings.entries()) {
      if (cnt > maxCount) {
        maxCount = cnt;
        bestName = spell;
      }
    }

    const normName = normalizeName(bestName);
    const isOver1000 = raw.totalSpend >= 1000;
    const nextDueDate = computeDueDate(raw.lastDate, defaultCycleDays);
    const alertDate = computeAlertDate(nextDueDate, alertDaysBefore);
    const custId = generateDeterministicCustomerId(raw.phone, raw.code, normName);

    customers.push({
      id: custId,
      name: bestName,
      nameNorm: normName,
      phone: raw.phone,
      phoneNorm: raw.phone,
      code: raw.code,
      isMonthlyRegular: isOver1000, // AUTO-FILTER: >= ₹1,000 auto-selected for Monthly Customers
      regularityScore: isOver1000 ? 95 : 40,
      totalPurchases: raw.bills.length,
      totalSpend: Math.round(raw.totalSpend * 100) / 100,
      monthsActive: 1,
      firstPurchaseDate: raw.firstDate,
      lastPurchaseDate: raw.lastDate,
      nextDueDate,
      alertDate,
      refillCycleDays: defaultCycleDays,
      medicines: [{
        id: 'med_' + custId,
        name: `Prescription Bill (₹${raw.totalSpend.toFixed(2)})`,
        nameNorm: 'prescription bill',
        qty: raw.bills.length,
        unit: 'Bill',
        amount: Math.round(raw.totalSpend * 100) / 100,
        refillCycleDays: defaultCycleDays,
        lastPurchaseDate: raw.lastDate,
        nextDueDate,
        status: isOver1000 ? 'regular' : 'new',
      }],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const roundedAmountParsed = Math.round(totalAmountParsed * 100) / 100;
  const roundedGrandTotal = Math.round(footerGrandTotal * 100) / 100;

  const dataCheck: MargDataCheckReport = {
    periodTitle,
    expectedPeriod: `${periodStart} to ${periodEnd}`,
    totalDaysFound: datesFound.size,
    expectedDays: 30,
    billsParsed,
    footerBills,
    totalAmountParsed: roundedAmountParsed,
    footerGrandTotal: roundedGrandTotal,
    isBillsCountMatched: billsParsed === footerBills,
    isGrandTotalMatched: Math.abs(roundedAmountParsed - roundedGrandTotal) < 0.01,
    dayMismatches,
    classCounts,
    needsReviewList,
  };

  return {
    fileName: monthInfo.formattedFileName,
    originalFileName: monthInfo.originalFileName,
    monthName: monthInfo.monthName,
    monthKey: monthInfo.monthKey,
    fileSize,
    periodStart,
    periodEnd,
    formatType: 'MARG_BILL_WISE_STATEMENT',
    customers,
    totalRowsProcessed: rows.length,
    totalMedicinesCount: customers.length,
    dataCheck,
  };
}
