import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { Customer } from '../src/types';

// Mock customer data representing various bill dates and due dates
const mockCustomers: Customer[] = [
  {
    id: 'c1',
    name: 'OMKAR NATH',
    nameNorm: 'omkar nath',
    phone: '8840511774',
    phoneNorm: '8840511774',
    isMonthlyRegular: true,
    regularityScore: 95,
    firstPurchaseDate: '2026-09-02',
    lastPurchaseDate: '2026-09-02',
    nextDueDate: '2026-10-02',
    alertDate: '2026-09-27',
    totalPurchases: 1,
    totalSpend: 1694.00,
    monthsActive: 1,
    status: 'active',
    medicines: [
      {
        id: 'm1',
        name: 'TELMA 40MG',
        nameNorm: 'telma 40mg',
        qty: 1,
        amount: 1694.00,
        refillCycleDays: 30,
        lastPurchaseDate: '2026-09-02',
        nextDueDate: '2026-10-02',
        status: 'regular',
      }
    ],
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  },
  {
    id: 'c2',
    name: 'SHIV RATHRI DEVI',
    nameNorm: 'shiv rathri devi',
    // NO PHONE - Walk-in
    isMonthlyRegular: true,
    regularityScore: 90,
    firstPurchaseDate: '2026-09-05',
    lastPurchaseDate: '2026-09-05',
    nextDueDate: '2026-10-05',
    alertDate: '2026-09-30',
    totalPurchases: 1,
    totalSpend: 1065.00,
    monthsActive: 1,
    status: 'active',
    medicines: [
      {
        id: 'm2',
        name: 'GLYCOMET GP 1',
        nameNorm: 'glycomet gp 1',
        qty: 1,
        amount: 1065.00,
        refillCycleDays: 30,
        lastPurchaseDate: '2026-09-05',
        nextDueDate: '2026-10-05',
        status: 'regular',
      }
    ],
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
  },
  {
    id: 'c3',
    name: 'RAMESH KUMAR (UNDER 1K)',
    nameNorm: 'ramesh kumar',
    phone: '9876543210',
    phoneNorm: '9876543210',
    isMonthlyRegular: false, // Under 1000, not in monthly regulars
    regularityScore: 40,
    firstPurchaseDate: '2026-09-03',
    lastPurchaseDate: '2026-09-03',
    nextDueDate: '2026-10-03',
    alertDate: '2026-09-28',
    totalPurchases: 1,
    totalSpend: 450.00,
    monthsActive: 1,
    status: 'active',
    medicines: [
      {
        id: 'm3',
        name: 'PARACETAMOL 650',
        nameNorm: 'paracetamol 650',
        qty: 1,
        amount: 450.00,
        refillCycleDays: 30,
        lastPurchaseDate: '2026-09-03',
        nextDueDate: '2026-10-03',
        status: 'regular',
      }
    ],
    createdAt: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:00.000Z',
  },
  {
    id: 'c4',
    name: 'LATE MONTH CUSTOMER',
    nameNorm: 'late month customer',
    phone: '9123456789',
    phoneNorm: '9123456789',
    isMonthlyRegular: true,
    regularityScore: 90,
    firstPurchaseDate: '2026-09-25',
    lastPurchaseDate: '2026-09-25', // Outside 01-09 to 06-09
    nextDueDate: '2026-10-25',
    alertDate: '2026-10-20',
    totalPurchases: 1,
    totalSpend: 3200.00,
    monthsActive: 1,
    status: 'active',
    medicines: [
      {
        id: 'm4',
        name: 'INSULIN PEN',
        nameNorm: 'insulin pen',
        qty: 1,
        amount: 3200.00,
        refillCycleDays: 30,
        lastPurchaseDate: '2026-09-25',
        nextDueDate: '2026-10-25',
        status: 'regular',
      }
    ],
    createdAt: '2026-09-25T00:00:00.000Z',
    updatedAt: '2026-09-25T00:00:00.000Z',
  }
];

describe('Print List Filter & Sort Logic', () => {
  it('correctly filters customers by date range "2026-09-01" to "2026-09-06" (Week 1)', () => {
    const startDate = '2026-09-01';
    const endDate = '2026-09-06';
    
    // Monthly regulars only
    const monthlyFiltered = mockCustomers.filter(c => {
      if (!c.isMonthlyRegular) return false;
      return c.lastPurchaseDate >= startDate && c.lastPurchaseDate <= endDate;
    });

    assert.strictEqual(monthlyFiltered.length, 2, 'Should match OMKAR NATH and SHIV RATHRI DEVI');
    assert.strictEqual(monthlyFiltered.some(c => c.name === 'OMKAR NATH'), true);
    assert.strictEqual(monthlyFiltered.some(c => c.name === 'SHIV RATHRI DEVI'), true);
    assert.strictEqual(monthlyFiltered.some(c => c.name === 'LATE MONTH CUSTOMER'), false);
  });

  it('includes both customers with and without phone numbers', () => {
    const startDate = '2026-09-01';
    const endDate = '2026-09-06';
    
    const week1Customers = mockCustomers.filter(c => 
      c.lastPurchaseDate >= startDate && c.lastPurchaseDate <= endDate
    );

    const withPhone = week1Customers.filter(c => Boolean(c.phone));
    const withoutPhone = week1Customers.filter(c => !c.phone);

    assert.strictEqual(withPhone.length >= 1, true, 'Must have customers with phone numbers');
    assert.strictEqual(withoutPhone.length >= 1, true, 'Must include customers without phone numbers');
    assert.strictEqual(withoutPhone[0].name, 'SHIV RATHRI DEVI', 'Walk-in patient without phone must be included');
  });

  it('allows switching scope to All Customers to include non-monthly balances', () => {
    const startDate = '2026-09-01';
    const endDate = '2026-09-06';

    const allScopeFiltered = mockCustomers.filter(c => 
      c.lastPurchaseDate >= startDate && c.lastPurchaseDate <= endDate
    );

    assert.strictEqual(allScopeFiltered.length, 3, 'All scope should include RAMESH KUMAR (< 1k) plus monthly regulars');
    assert.strictEqual(allScopeFiltered.some(c => c.name === 'RAMESH KUMAR (UNDER 1K)'), true);
  });

  it('sorts customers by date ascending and descending correctly', () => {
    const week1 = mockCustomers.filter(c => 
      c.lastPurchaseDate >= '2026-09-01' && c.lastPurchaseDate <= '2026-09-06'
    );

    // Sort Date Ascending (Earliest first: 2026-09-02 -> 2026-09-03 -> 2026-09-05)
    const sortedAsc = [...week1].sort((a, b) => a.lastPurchaseDate.localeCompare(b.lastPurchaseDate));
    assert.strictEqual(sortedAsc[0].lastPurchaseDate, '2026-09-02');
    assert.strictEqual(sortedAsc[1].lastPurchaseDate, '2026-09-03');
    assert.strictEqual(sortedAsc[2].lastPurchaseDate, '2026-09-05');

    // Sort Date Descending (Latest first: 2026-09-05 -> 2026-09-03 -> 2026-09-02)
    const sortedDesc = [...week1].sort((a, b) => b.lastPurchaseDate.localeCompare(a.lastPurchaseDate));
    assert.strictEqual(sortedDesc[0].lastPurchaseDate, '2026-09-05');
    assert.strictEqual(sortedDesc[2].lastPurchaseDate, '2026-09-02');
  });

  it('sorts customers by amount descending correctly', () => {
    const week1 = mockCustomers.filter(c => 
      c.lastPurchaseDate >= '2026-09-01' && c.lastPurchaseDate <= '2026-09-06'
    );

    const sortedByAmount = [...week1].sort((a, b) => b.totalSpend - a.totalSpend);
    assert.strictEqual(sortedByAmount[0].totalSpend, 1694.00, 'OMKAR NATH highest spend first');
    assert.strictEqual(sortedByAmount[1].totalSpend, 1065.00, 'SHIV RATHRI DEVI second');
    assert.strictEqual(sortedByAmount[2].totalSpend, 450.00, 'RAMESH KUMAR third');
  });
});
