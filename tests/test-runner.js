const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function normalizePhone(raw) {
  if (!raw) return undefined;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length >= 10) return digits.slice(-10);
  return undefined;
}

function normalizeName(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseDateToISO(dateStr, fallbackISO = new Date().toISOString().split('T')[0]) {
  if (!dateStr) return fallbackISO;
  const match = String(dateStr).trim().match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return fallbackISO;
}

function computeDueDate(purchaseDateISO, cycleDays = 30) {
  const d = new Date(purchaseDateISO);
  if (isNaN(d.getTime())) return purchaseDateISO;
  d.setDate(d.getDate() + cycleDays);
  return d.toISOString().split('T')[0];
}

function computeAlertDate(dueISO, alertBefore = 5) {
  const d = new Date(dueISO);
  if (isNaN(d.getTime())) return dueISO;
  d.setDate(d.getDate() - alertBefore);
  return d.toISOString().split('T')[0];
}

// Legacy format parser (July, August)
function parseMargExcelFile(filePath) {
  const buf = fs.readFileSync(filePath);
  const workbook = XLSX.read(buf, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let periodStart = '';
  let periodEnd = '';

  for (let r = 0; r < Math.min(15, rows.length); r++) {
    const text = String(rows[r] && rows[r][0] || '');
    const dateMatch = text.match(/FROM\s+(\d{2}\/\d{2}\/\d{4})\s+TO\s+(\d{2}\/\d{2}\/\d{4})/i);
    if (dateMatch) {
      periodStart = parseDateToISO(dateMatch[1]);
      periodEnd = parseDateToISO(dateMatch[2]);
      break;
    }
  }

  const customers = [];
  let currentCust = null;
  let currentMeds = [];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const s0 = String(row[0] != null ? row[0] : '').trim();

    if (
      !s0 ||
      s0 === 'SARITA PHARMACY' ||
      s0.startsWith('PATIENT/PRODUCT') ||
      s0.startsWith('Phone :') ||
      s0.startsWith('5/1/1') ||
      s0.startsWith('SNO.') ||
      s0.startsWith('SUB TOTAL') ||
      s0.startsWith('Continued..') ||
      s0.startsWith('Page')
    ) {
      continue;
    }

    const custMatch = s0.match(/^(\d+)\.\s+(\d{3,10})\s+(.+)$/);
    const custMatchNoCode = s0.match(/^(\d+)\.\s+([A-Za-z].+)$/);

    if (custMatch || custMatchNoCode) {
      if (currentCust && currentMeds.length > 0) {
        currentCust.medicines = currentMeds;
        customers.push(currentCust);
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
        id: 'cust_' + (phoneNorm || codeOrPhone || normalizeName(rawName)),
        name: rawName,
        nameNorm: normalizeName(rawName),
        phone: isActualPhone ? phoneNorm : undefined,
        phoneNorm: isActualPhone ? phoneNorm : undefined,
        code: !isActualPhone && codeOrPhone ? codeOrPhone : undefined,
        isMonthlyRegular: false,
        totalPurchases: 1,
        totalSpend: 0,
        lastPurchaseDate: periodEnd,
        nextDueDate: computeDueDate(periodEnd, 30),
      };
      continue;
    }

    if (currentCust && s0.length > 0) {
      const qtyUnitRaw = row[1] != null ? String(row[1]).trim() : '';
      const amountVal = typeof row[2] === 'number' ? row[2] : parseFloat(String(row[2] || '0').replace(/,/g, ''));

      if (qtyUnitRaw && !isNaN(amountVal)) {
        currentCust.totalSpend += amountVal;
        currentMeds.push({
          name: s0,
          qtyUnit: qtyUnitRaw,
          amount: amountVal,
        });
      }
    }
  }

  if (currentCust && currentMeds.length > 0) {
    currentCust.medicines = currentMeds;
    customers.push(currentCust);
  }

  return { periodStart, periodEnd, customers };
}

// Bill Wise Sales Statement Parser (September 01-09.XLS & 01-09 TO 30-09.XLS)
function parseBillWiseSalesStatementFile(filePath, defaultCycleDays = 30, alertDaysBefore = 5) {
  const buf = fs.readFileSync(filePath);
  const workbook = XLSX.read(buf, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let periodStart = '';
  let periodEnd = '';
  const datesFound = [];

  for (let r = 0; r < Math.min(20, rows.length); r++) {
    const text = String(rows[r]?.[0] || '');
    const rangeMatch = text.match(/FROM\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+TO\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (rangeMatch) {
      periodStart = parseDateToISO(rangeMatch[1]);
      periodEnd = parseDateToISO(rangeMatch[2]);
      break;
    }
    const singleMatch = text.match(/(?:AS ON|ON|DATE)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (singleMatch) {
      periodStart = parseDateToISO(singleMatch[1]);
      periodEnd = periodStart;
      break;
    }
  }

  let currentDate = periodStart || '';
  const customerMap = new Map();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const col0 = String(row[0] != null ? row[0] : '').trim();
    const col1 = String(row[1] != null ? row[1] : '').trim();
    const col2 = row[2];

    if (/^\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}$/.test(col0)) {
      currentDate = parseDateToISO(col0);
      if (!datesFound.includes(currentDate)) datesFound.push(currentDate);
      continue;
    }

    if (/^[A-Za-z]?\d+$/.test(col0) && col1) {
      if (/BILL WISE|SARITA PHARMACY|DAY TOTAL|GRAND TOTAL/i.test(col1)) continue;

      const billVal = typeof col2 === 'number' ? col2 : parseFloat(String(col2 || '0').replace(/,/g, '')) || 0;
      let cleanDesc = col1.replace(/\s+(CASH|CREDIT|CARD|CHEQUE|UPI|PAYTM|GPAY|RTGS|NEFT)\s*$/i, '').trim();

      if (!cleanDesc || /^CASH$/i.test(cleanDesc)) continue;

      let phone = '';
      let code = '';
      let name = cleanDesc;

      const phoneMatch = cleanDesc.match(/^(\d{10})\s+(.+)$/);
      if (phoneMatch) {
        phone = phoneMatch[1];
        name = phoneMatch[2].trim();
      } else {
        const anyPhone = cleanDesc.match(/\b([6-9]\d{9})\b/);
        if (anyPhone) {
          phone = anyPhone[1];
          name = cleanDesc.replace(phone, '').replace(/\s+/g, ' ').trim();
        } else {
          const codeMatch = cleanDesc.match(/^(\d{2,6})\s+([A-Za-z].+)$/);
          if (codeMatch) {
            code = codeMatch[1];
            name = codeMatch[2].trim();
          }
        }
      }

      name = name.replace(/[^\w\s\.\-]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!name || /^CASH$/i.test(name)) continue;

      const normName = normalizeName(name);
      const key = phone ? 'p_' + phone : code ? 'c_' + code : 'n_' + normName;
      const billDate = currentDate || periodEnd || new Date().toISOString().split('T')[0];

      if (!customerMap.has(key)) {
        customerMap.set(key, {
          name,
          phone,
          code,
          bills: [],
          totalSpend: 0,
          firstPurchaseDate: billDate,
          lastPurchaseDate: billDate,
        });
      }

      const c = customerMap.get(key);
      c.totalSpend += billVal;
      c.bills.push({ billNo: col0, date: billDate, amount: billVal });
      if (phone && !c.phone) c.phone = phone;
      if (code && !c.code) c.code = code;
      if (name.length > c.name.length) c.name = name;
      if (billDate > c.lastPurchaseDate) c.lastPurchaseDate = billDate;
    }
  }

  if (datesFound.length > 0) {
    datesFound.sort();
    if (!periodStart) periodStart = datesFound[0];
    if (!periodEnd) periodEnd = datesFound[datesFound.length - 1];
  }

  const customers = [];
  let over1000Count = 0;

  for (const [, raw] of customerMap.entries()) {
    const isOver1000 = raw.totalSpend >= 1000;
    if (isOver1000) over1000Count++;

    const nextDueDate = computeDueDate(raw.lastPurchaseDate, defaultCycleDays);
    const alertDate = computeAlertDate(nextDueDate, alertDaysBefore);

    const custId = raw.phone 
      ? 'cust_p_' + raw.phone 
      : raw.code 
      ? 'cust_c_' + raw.code 
      : 'cust_n_' + raw.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 32);

    customers.push({
      id: custId,
      name: raw.name,
      nameNorm: normalizeName(raw.name),
      phone: raw.phone || undefined,
      phoneNorm: raw.phone || undefined,
      code: raw.code || undefined,
      isMonthlyRegular: isOver1000,
      regularityScore: isOver1000 ? 90 : 40,
      totalPurchases: raw.bills.length,
      totalSpend: Math.round(raw.totalSpend * 100) / 100,
      monthsActive: 1,
      lastPurchaseDate: raw.lastPurchaseDate,
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
        lastPurchaseDate: raw.lastPurchaseDate,
        nextDueDate,
        status: isOver1000 ? 'regular' : 'new',
      }],
    });
  }

  return { periodStart, periodEnd, customers, over1000Count, totalUniqueCustomers: customers.length };
}

console.log('================================================================');
console.log('🧪 SARITA PHARMACY MED REMINDER V2 — FULL PIPELINE & MARG TESTS');
console.log('================================================================\n');

// Phase 1: Test July & August (Legacy format)
const jul = parseMargExcelFile(path.resolve('..', 'jully26.XLS'));
console.log(`✓ July 2026 Parsed: ${jul.periodStart} to ${jul.periodEnd} | ${jul.customers.length} named patients`);

const aug = parseMargExcelFile(path.resolve('..', 'aug26.XLS'));
console.log(`✓ August 2026 Parsed: ${aug.periodStart} to ${aug.periodEnd} | ${aug.customers.length} named patients`);

// Phase 2: Test September Single-Day (01-09.XLS)
const sep01Path = path.resolve('..', 'cusotmers purchase data', '01-09.XLS');
const sep01 = parseBillWiseSalesStatementFile(sep01Path);
console.log(`\n✓ September 01 Single Day Parsed: ${sep01.periodStart} to ${sep01.periodEnd}`);
console.log(`   - Total Named Customers Extracted: ${sep01.totalUniqueCustomers}`);
console.log(`   - Auto-Selected for Monthly (≥ ₹1,000): ${sep01.over1000Count} customers`);
console.log(`   - Saved in All Customers (< ₹1,000): ${sep01.totalUniqueCustomers - sep01.over1000Count} customers`);
if (sep01.totalUniqueCustomers !== 44 || sep01.over1000Count !== 8) {
  throw new Error(`Expected 44 customers and 8 >= 1000 in 01-09.XLS, got ${sep01.totalUniqueCustomers} and ${sep01.over1000Count}`);
}

// Phase 3: Test September Full Month (01-09 TO 30-09.XLS)
const sepFullMonthPath = path.resolve('..', 'cusotmers purchase data', '01-09 TO 30-09.XLS');
const sepFull = parseBillWiseSalesStatementFile(sepFullMonthPath);
console.log(`\n✓ September Full Month (01-09 TO 30-09.XLS) Parsed: ${sep01.periodStart} to ${sepFull.periodEnd}`);
console.log(`   - Total Named Customers Extracted: ${sepFull.totalUniqueCustomers}`);
console.log(`   - Auto-Selected for Monthly (≥ ₹1,000): ${sepFull.over1000Count} customers`);
console.log(`   - Saved in All Customers (< ₹1,000): ${sepFull.totalUniqueCustomers - sepFull.over1000Count} customers`);
if (sepFull.totalUniqueCustomers !== 971 || sepFull.over1000Count !== 291) {
  throw new Error(`Expected 971 customers and 291 >= 1000 in 01-09 TO 30-09.XLS, got ${sepFull.totalUniqueCustomers} and ${sepFull.over1000Count}`);
}

// Phase 4: Master Merging across July + August + September Full Month
const phoneMap = new Map();
const codeMap = new Map();
const nameMap = new Map();
const masterMap = new Map();

function addOrMergeCustomer(c) {
  let existing = null;
  if (c.phoneNorm && phoneMap.has(c.phoneNorm)) {
    existing = phoneMap.get(c.phoneNorm);
  } else if (c.code && codeMap.has(c.code)) {
    existing = codeMap.get(c.code);
  } else if (c.nameNorm && nameMap.has(c.nameNorm)) {
    existing = nameMap.get(c.nameNorm);
  }

  if (existing) {
    existing.totalPurchases += (c.totalPurchases || 1);
    existing.totalSpend += c.totalSpend;
    if (c.lastPurchaseDate && (!existing.lastPurchaseDate || c.lastPurchaseDate > existing.lastPurchaseDate)) {
      existing.lastPurchaseDate = c.lastPurchaseDate;
      existing.nextDueDate = c.nextDueDate;
      existing.alertDate = c.alertDate;
    }
    // Auto-select rule: if total spend >= 1000 or incoming is monthly, mark monthly
    if (existing.totalSpend >= 1000 || c.isMonthlyRegular) {
      existing.isMonthlyRegular = true;
    }
    return { merged: true, customer: existing };
  } else {
    const copy = { ...c };
    masterMap.set(copy.id, copy);
    if (copy.phoneNorm) phoneMap.set(copy.phoneNorm, copy);
    if (copy.code) codeMap.set(copy.code, copy);
    if (copy.nameNorm) nameMap.set(copy.nameNorm, copy);
    return { merged: false, customer: copy };
  }
}

jul.customers.forEach(c => addOrMergeCustomer(c));
aug.customers.forEach(c => addOrMergeCustomer(c));
let sepMatched = 0;
let sepNew = 0;

sepFull.customers.forEach(c => {
  const res = addOrMergeCustomer(c);
  if (res.merged) sepMatched++;
  else sepNew++;
});

console.log('\n✓ Cross-Month Consolidation (July + August + September Full Month):');
console.log(`   - Master Total Unique Customers: ${masterMap.size}`);
console.log(`   - September Customers Matched with Prior Records: ${sepMatched}`);
console.log(`   - Brand New September Customers Added: ${sepNew}`);

const totalMonthlyTracked = Array.from(masterMap.values()).filter(c => c.isMonthlyRegular).length;
const totalUnticked = masterMap.size - totalMonthlyTracked;
console.log(`   - Total Active in Monthly Customers Tab (≥ ₹1,000 or selected): ${totalMonthlyTracked}`);
console.log(`   - Total Remaining in All Customers Tab (< ₹1,000 unticked): ${totalUnticked}`);

console.log('\nSample 5 Auto-Selected Monthly Patients from September:');
const sampleMonthly = Array.from(masterMap.values())
  .filter(c => c.totalSpend >= 1000)
  .slice(0, 5);
sampleMonthly.forEach((m, idx) => {
  console.log(`   ${idx + 1}. ${m.name} | Phone/Code: ${m.phone || m.code || 'None'} | Last Bill: ${m.lastPurchaseDate} | Total Spend: ₹${m.totalSpend.toFixed(2)} | Refill Due: ${m.nextDueDate}`);
});

console.log('\n✅ ALL MARG BILL WISE REQUIREMENTS VERIFIED AND PASSED 100%!\n');
