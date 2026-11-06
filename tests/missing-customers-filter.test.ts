import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { Customer, UploadBatch, ReminderItem } from '../src/types';
import { computeMissingCustomers } from '../src/lib/monthly-comparator';

// Mock Customers
const customerA: Customer = {
  id: 'cust_a',
  name: 'RAMESH KUMAR (Retained in Oct)',
  nameNorm: 'ramesh kumar',
  phone: '9839000001',
  phoneNorm: '9839000001',
  isMonthlyRegular: true,
  regularityScore: 90,
  firstPurchaseDate: '2026-09-10',
  lastPurchaseDate: '2026-10-12',
  nextDueDate: '2026-11-12',
  alertDate: '2026-11-07',
  totalPurchases: 2,
  totalSpend: 3500,
  monthsActive: 2,
  status: 'active',
  medicines: [
    {
      id: 'm1',
      name: 'TELMA 40MG',
      nameNorm: 'telma 40mg',
      qty: 2,
      amount: 1500,
      refillCycleDays: 30,
      lastPurchaseDate: '2026-10-12',
      nextDueDate: '2026-11-12',
      status: 'regular',
    }
  ],
  createdAt: '2026-09-10',
  updatedAt: '2026-10-12',
};

const customerB: Customer = {
  id: 'cust_b',
  name: 'SURESH VERMA (Missing in Oct)',
  nameNorm: 'suresh verma',
  phone: '9839000002',
  phoneNorm: '9839000002',
  isMonthlyRegular: true,
  regularityScore: 85,
  firstPurchaseDate: '2026-09-15',
  lastPurchaseDate: '2026-09-15',
  nextDueDate: '2026-10-15', // Past due date
  alertDate: '2026-10-10',
  totalPurchases: 1,
  totalSpend: 1800,
  monthsActive: 1,
  status: 'active',
  medicines: [
    {
      id: 'm2',
      name: 'GLYCOMET 500',
      nameNorm: 'glycomet 500',
      qty: 1,
      amount: 1800,
      refillCycleDays: 30,
      lastPurchaseDate: '2026-09-15',
      nextDueDate: '2026-10-15',
      status: 'regular',
    }
  ],
  createdAt: '2026-09-15',
  updatedAt: '2026-09-15',
};

const customerC: Customer = {
  id: 'cust_c',
  name: 'ANITA SHARMA (New in Oct)',
  nameNorm: 'anita sharma',
  phone: '9839000003',
  phoneNorm: '9839000003',
  isMonthlyRegular: true,
  regularityScore: 90,
  firstPurchaseDate: '2026-10-05',
  lastPurchaseDate: '2026-10-05',
  nextDueDate: '2026-11-05',
  alertDate: '2026-10-31',
  totalPurchases: 1,
  totalSpend: 2200,
  monthsActive: 1,
  status: 'active',
  medicines: [
    {
      id: 'm3',
      name: 'ECOSPRIN 75',
      nameNorm: 'ecosprin 75',
      qty: 1,
      amount: 2200,
      refillCycleDays: 30,
      lastPurchaseDate: '2026-10-05',
      nextDueDate: '2026-11-05',
      status: 'regular',
    }
  ],
  createdAt: '2026-10-05',
  updatedAt: '2026-10-05',
};

// Batches
const batchSept: UploadBatch = {
  id: 'batch_sept_2026',
  fileName: 'September 2026 Sales.XLS',
  monthName: 'September 2026',
  monthKey: '2026-09',
  fileSize: 450000,
  uploadDate: '2026-09-30T18:00:00Z',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  formatType: 'MARG_BILL_WISE_STATEMENT',
  totalRows: 500,
  totalCustomers: 2,
  newCustomersCount: 2,
  repeatCustomersCount: 0,
  status: 'committed',
  customerIds: ['cust_a', 'cust_b'], // Ramesh & Suresh in September
};

const batchOct: UploadBatch = {
  id: 'batch_oct_2026',
  fileName: 'October 2026 Sales.XLS',
  monthName: 'October 2026',
  monthKey: '2026-10',
  fileSize: 480000,
  uploadDate: '2026-10-31T18:00:00Z',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  formatType: 'MARG_BILL_WISE_STATEMENT',
  totalRows: 520,
  totalCustomers: 2,
  newCustomersCount: 1,
  repeatCustomersCount: 1,
  status: 'committed',
  customerIds: ['cust_a', 'cust_c'], // Ramesh & Anita in October (Suresh missing!)
};

// Reminders
const reminderA: ReminderItem = {
  id: 'rem_cust_a',
  customerId: 'cust_a',
  customerName: customerA.name,
  customerPhone: customerA.phone,
  dueDate: '2026-11-12',
  alertDate: '2026-11-07',
  daysRemaining: 6,
  urgency: 'UPCOMING',
  medicinesSummary: 'TELMA 40MG',
  medicinesList: ['TELMA 40MG'],
  status: 'pending',
  deliveryNeeded: false,
};

const reminderB: ReminderItem = {
  id: 'rem_cust_b',
  customerId: 'cust_b',
  customerName: customerB.name,
  customerPhone: customerB.phone,
  dueDate: '2026-10-15',
  alertDate: '2026-10-10',
  daysRemaining: -22, // Overdue because Suresh never purchased in October!
  urgency: 'OVERDUE',
  medicinesSummary: 'GLYCOMET 500',
  medicinesList: ['GLYCOMET 500'],
  status: 'pending',
  deliveryNeeded: false,
};

const reminderC: ReminderItem = {
  id: 'rem_cust_c',
  customerId: 'cust_c',
  customerName: customerC.name,
  customerPhone: customerC.phone,
  dueDate: '2026-11-05',
  alertDate: '2026-10-31',
  daysRemaining: -1, // Just became due
  urgency: 'OVERDUE',
  medicinesSummary: 'ECOSPRIN 75',
  medicinesList: ['ECOSPRIN 75'],
  status: 'pending',
  deliveryNeeded: false,
};

describe('Missing Customers Filter and Workflow Separation', () => {
  it('returns hasComparison: false when only single month is uploaded (no missing customers hidden)', () => {
    const allCustomers = [customerA, customerB];
    const singleBatch = [batchSept];

    const result = computeMissingCustomers(singleBatch, allCustomers);
    assert.strictEqual(result.hasComparison, false);
    assert.strictEqual(result.missingCustomerIds.size, 0);
  });

  it('accurately identifies Suresh (cust_b) as missing when October is uploaded after September', () => {
    const allCustomers = [customerA, customerB, customerC];
    const twoBatches = [batchSept, batchOct];

    const result = computeMissingCustomers(twoBatches, allCustomers);
    assert.strictEqual(result.hasComparison, true);
    assert.strictEqual(result.previousMonthLabel, 'Sep 2026');
    assert.strictEqual(result.missingCustomerIds.size, 1);
    assert.ok(result.missingCustomerIds.has('cust_b'), 'Suresh should be identified as missing');
    assert.ok(!result.missingCustomerIds.has('cust_a'), 'Ramesh was retained and should not be missing');
    assert.ok(!result.missingCustomerIds.has('cust_c'), 'Anita is new in Oct and should not be missing');
  });

  it('Dashboard separation: default queue isolates active patients and hides missing customers', () => {
    const allCustomers = [customerA, customerB, customerC];
    const twoBatches = [batchSept, batchOct];
    const allReminders = [reminderA, reminderB, reminderC];

    const { missingCustomerIds, hasComparison } = computeMissingCustomers(twoBatches, allCustomers);

    const isMissingReminder = (r: ReminderItem) => hasComparison && missingCustomerIds.has(r.customerId);
    const activeReminders = allReminders.filter((r) => !isMissingReminder(r));
    const missingReminders = allReminders.filter((r) => isMissingReminder(r));

    // Active reminders must only have cust_a and cust_c
    assert.strictEqual(activeReminders.length, 2);
    assert.ok(activeReminders.some(r => r.customerId === 'cust_a'));
    assert.ok(activeReminders.some(r => r.customerId === 'cust_c'));

    // Missing reminders must only have cust_b
    assert.strictEqual(missingReminders.length, 1);
    assert.strictEqual(missingReminders[0].customerId, 'cust_b');
  });

  it('Monthly Customers Tab: filtering by statusFilter === "MISSING" isolates missing patients', () => {
    const allCustomers = [customerA, customerB, customerC];
    const twoBatches = [batchSept, batchOct];

    const { missingCustomerIds } = computeMissingCustomers(twoBatches, allCustomers);
    const monthlyCustomers = allCustomers.filter(c => c.isMonthlyRegular && c.status === 'active');

    const filteredMissing = monthlyCustomers.filter(c => missingCustomerIds.has(c.id));
    assert.strictEqual(filteredMissing.length, 1);
    assert.strictEqual(filteredMissing[0].id, 'cust_b');
  });

  it('Print List Tab: selecting preset "MISSING" gathers all missing customers across the entire month', () => {
    const allCustomers = [customerA, customerB, customerC];
    const twoBatches = [batchSept, batchOct];

    const { missingCustomerIds, hasComparison } = computeMissingCustomers(twoBatches, allCustomers);

    // Simulate print list processedRows filtering
    const activePreset = 'MISSING';
    const customerScope = 'MONTHLY';

    const printRows = allCustomers.filter(cust => {
      if (activePreset === 'MISSING' && (!hasComparison || !missingCustomerIds.has(cust.id))) {
        return false;
      }
      if (customerScope === 'MONTHLY' && !cust.isMonthlyRegular) {
        return false;
      }
      return true;
    });

    assert.strictEqual(printRows.length, 1);
    assert.strictEqual(printRows[0].id, 'cust_b');
    assert.strictEqual(printRows[0].name, 'SURESH VERMA (Missing in Oct)');
  });
});

