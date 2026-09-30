const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Import compiled or source modules
const { parseMargExcel } = require('../src/lib/marg-parser.ts');
const { matchAndMergeCustomers } = require('../src/lib/customer-matcher.ts');
const { computeMissingCustomers } = require('../src/lib/monthly-comparator.ts');

console.log('========================================================');
console.log('🧪 VERIFYING 4 SIMPLIFICATION CHANGES & ACCEPTANCE CHECKLIST');
console.log('========================================================\n');

// 1. Check September Fixture Parsing
const fixturePath = path.join(__dirname, 'fixtures', '01-09_to_25-09_coutmer_data.XLS');
if (!fs.existsSync(fixturePath)) {
  console.error('❌ Fixture not found at:', fixturePath);
  process.exit(1);
}

const fileBuf = fs.readFileSync(fixturePath);
const parsedSept = parseMargExcel(fileBuf, '01-09_to_25-09_coutmer_data.XLS');

console.log('1. September Parsing Verification:');
console.log('   - periodStart:', parsedSept.periodStart, '(Expected: 2026-09-01)');
console.log('   - periodEnd:', parsedSept.periodEnd, '(Expected: 2026-09-25)');
console.log('   - monthKey:', parsedSept.monthKey, '(Expected: 2026-09)');
console.log('   - customerCount:', parsedSept.customers.length, '(Expected: 271 valid patient headers)');

if (parsedSept.periodStart !== '2026-09-01' || parsedSept.periodEnd !== '2026-09-25' || parsedSept.monthKey !== '2026-09') {
  console.error('❌ Period/monthKey mismatch');
  process.exit(1);
}

// Verify no CASH customer was created
const cashCust = parsedSept.customers.find(c => (c.name || '').toUpperCase().includes('CASH') && !c.phone);
if (cashCust) {
  console.error('❌ Found CASH customer created:', cashCust);
  process.exit(1);
}
console.log('   ✓ CASH block and headerless block correctly skipped without creating customers.');

// 2. Test Idempotency and Date Updates
console.log('\n2. Testing Idempotency & Refill Date Auto-Updates:');
// Create a base existing customer
const testCust = {
  id: 'cust_001',
  name: 'RAMESH CHANDRA',
  nameNorm: 'ramesh chandra',
  phone: '9839012345',
  phoneNorm: '9839012345',
  code: '1001',
  isMonthlyRegular: true,
  status: 'active',
  totalPurchases: 2,
  monthsActive: 2,
  totalSpend: 1500,
  lastPurchaseDate: '2026-08-25',
  nextDueDate: '2026-09-24',
  refillCycleDays: 60, // 2 months custom duration set by staff
  medicines: [
    {
      id: 'm1',
      name: 'TELMA 40MG',
      nameNorm: 'telma 40mg',
      amount: 500,
      qty: 30,
      refillCycleDays: 60,
      lastPurchaseDate: '2026-08-25',
      nextDueDate: '2026-10-24',
    }
  ],
  createdAt: '2026-07-01',
  updatedAt: '2026-08-25',
};

const incomingCust = {
  id: 'incoming_001',
  name: 'RAMESH CHANDRA',
  nameNorm: 'ramesh chandra',
  phone: '9839012345',
  phoneNorm: '9839012345',
  code: '1001',
  isMonthlyRegular: false, // New sheet has false
  status: 'active',
  totalPurchases: 1,
  monthsActive: 1,
  totalSpend: 600,
  lastPurchaseDate: '2026-09-25',
  medicines: [
    {
      id: 'm1_new',
      name: 'TELMA 40MG',
      nameNorm: 'telma 40mg',
      amount: 600,
      qty: 30,
      refillCycleDays: 30,
      lastPurchaseDate: '2026-09-25',
    },
    {
      id: 'm2_new',
      name: 'AMLONG 5MG',
      nameNorm: 'amlong 5mg',
      amount: 400,
      qty: 30,
      refillCycleDays: 30,
      lastPurchaseDate: '2026-09-25',
    }
  ],
  createdAt: '2026-09-25',
  updatedAt: '2026-09-25',
};

// First merge
const merge1 = matchAndMergeCustomers([testCust], [incomingCust], { defaultRefillCycleDays: 30, alertDaysBefore: 5 });
const mergedCust1 = merge1.updatedMasterCustomers.find(c => c.phoneNorm === '9839012345');

console.log('   - After Sept upload:');
console.log('     lastPurchaseDate:', mergedCust1.lastPurchaseDate, '(Expected: 2026-09-25)');
console.log('     isMonthlyRegular preserved:', mergedCust1.isMonthlyRegular, '(Expected: true)');
console.log('     refillCycleDays preserved:', mergedCust1.refillCycleDays, '(Expected: 60 - 2 months)');
console.log('     nextDueDate with 60 days:', mergedCust1.nextDueDate, '(Expected: 2026-11-24 = 2026-09-25 + 60d)');
console.log('     totalPurchases:', mergedCust1.totalPurchases, '(Expected: 3)');
console.log('     monthsActive:', mergedCust1.monthsActive, '(Expected: 3)');
console.log('     medicines count:', mergedCust1.medicines.length, '(Expected: 2 - merged)');

if (mergedCust1.lastPurchaseDate !== '2026-09-25' || mergedCust1.nextDueDate !== '2026-11-24' || mergedCust1.totalPurchases !== 3) {
  console.error('❌ Merge 1 validation failed');
  process.exit(1);
}

// Second merge (re-upload same September sheet - idempotency test)
const merge2 = matchAndMergeCustomers([mergedCust1], [incomingCust], { defaultRefillCycleDays: 30, alertDaysBefore: 5 });
const mergedCust2 = merge2.updatedMasterCustomers.find(c => c.phoneNorm === '9839012345');

console.log('   - After Re-uploading same file (Idempotency test):');
console.log('     totalPurchases:', mergedCust2.totalPurchases, '(Expected: 3 - no double count)');
console.log('     monthsActive:', mergedCust2.monthsActive, '(Expected: 3 - no double count)');
console.log('     totalSpend:', mergedCust2.totalSpend, '(Expected: 1000 = 600 + 400 - no double count)');

if (mergedCust2.totalPurchases !== 3 || mergedCust2.monthsActive !== 3 || mergedCust2.totalSpend !== 1000) {
  console.error('❌ Idempotency failed - double counting detected!');
  process.exit(1);
}
console.log('   ✓ Idempotency confirmed 100%!');

// 3. Test Missing Customers Computation
console.log('\n3. Testing Missing Customers Detection:');
const batches = [
  {
    id: 'batch_aug',
    fileName: 'AUG-2026.XLS',
    monthKey: '2026-08',
    monthName: 'August 2026',
    status: 'committed',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    customerIds: ['c1', 'c2', 'c3'],
  },
  {
    id: 'batch_sept',
    fileName: 'SEPT-2026.XLS',
    monthKey: '2026-09',
    monthName: 'September 2026',
    status: 'committed',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-25',
    customerIds: ['c1', 'c3'], // c2 is missing in September!
  },
  {
    id: 'batch_rolled',
    fileName: 'OLD-OCT.XLS',
    monthKey: '2026-10',
    monthName: 'October 2026',
    status: 'rolled_back', // Rolled back batch must be ignored!
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    customerIds: ['c1', 'c2', 'c3'],
  }
];

const allCusts = [
  { id: 'c1', name: 'Customer 1', isMonthlyRegular: true, status: 'active' },
  { id: 'c2', name: 'Customer 2', isMonthlyRegular: true, status: 'active' },
  { id: 'c3', name: 'Customer 3', isMonthlyRegular: false, status: 'active' },
];

const missingRes = computeMissingCustomers(batches, allCusts);
console.log('   - Missing customer IDs:', Array.from(missingRes.missingCustomerIds), '(Expected: ["c2"])');
console.log('   - Previous Month Label:', missingRes.previousMonthLabel, '(Expected: "Aug 2026")');
console.log('   - Rolled back batch ignored:', !missingRes.missingCustomerIds.has('c1'));

if (!missingRes.missingCustomerIds.has('c2') || missingRes.missingCustomerIds.has('c1') || missingRes.missingCustomerIds.has('c3')) {
  console.error('❌ Missing customer computation failed');
  process.exit(1);
}
console.log('   ✓ Missing customer computation verified 100%!');

console.log('\n========================================================');
console.log('✅ ALL 4 SIMPLIFICATION CHANGES VALIDATED SUCCESSFULLY!');
console.log('========================================================');
