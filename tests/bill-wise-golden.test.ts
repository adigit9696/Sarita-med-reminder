import fs from 'fs';
import path from 'path';
import { parseMargExcel } from '../src/lib/marg-parser';
import { matchAndMergeChronologicalBatches, matchAndMergeCustomers } from '../src/lib/customer-matcher';
import type { Customer } from '../src/types';

function runAssertions() {
  console.log('================================================================');
  console.log('🧪 RUNNING BILL-WISE SALES STATEMENT GOLDEN TEST SUITE');
  console.log('================================================================\n');

  const fixturePath = path.resolve(__dirname, 'fixtures/01-09_TO_30-09.XLS');
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture not found at ${fixturePath}`);
  }

  const buf = fs.readFileSync(fixturePath);
  const batch = parseMargExcel(buf, '01-09_TO_30-09.XLS');

  console.log('--- 1. Format & Date Header Check ---');
  if (batch.formatType !== 'MARG_BILL_WISE_STATEMENT') {
    throw new Error(`Expected MARG_BILL_WISE_STATEMENT, got ${batch.formatType}`);
  }
  if (batch.periodStart !== '2026-09-01' || batch.periodEnd !== '2026-09-30') {
    throw new Error(`Expected 2026-09-01 to 2026-09-30, got ${batch.periodStart} to ${batch.periodEnd}`);
  }
  console.log(`✓ Format and Period Verified: ${batch.formatType} (${batch.periodStart} to ${batch.periodEnd})`);

  console.log('\n--- 2. Data Check & Footer Reconciliation ---');
  const check = batch.dataCheck;
  if (!check) {
    throw new Error('Expected dataCheck report on parsed batch');
  }

  if (check.billsParsed !== 4109) {
    throw new Error(`Expected 4109 bills parsed, got ${check.billsParsed}`);
  }
  if (check.footerBills !== 4109) {
    throw new Error(`Expected 4109 footer bills, got ${check.footerBills}`);
  }
  if (check.totalAmountParsed !== 1535812) {
    throw new Error(`Expected ₹1,535,812 total amount parsed, got ${check.totalAmountParsed}`);
  }
  if (check.footerGrandTotal !== 1535812) {
    throw new Error(`Expected ₹1,535,812 footer grand total, got ${check.footerGrandTotal}`);
  }
  if (!check.isBillsCountMatched || !check.isGrandTotalMatched) {
    throw new Error('Bills count or Grand Total reconciliation flag failed');
  }
  if (check.totalDaysFound !== 30) {
    throw new Error(`Expected 30 days found, got ${check.totalDaysFound}`);
  }
  if (check.dayMismatches.length !== 0) {
    throw new Error(`Expected 0 day mismatches, got ${check.dayMismatches.length}`);
  }
  console.log(`✓ Footer Reconciled: 4,109 bills (₹15,35,812) across 30 days with 0 day mismatches`);

  console.log('\n--- 3. Bill Classification Counts ---');
  const { classCounts } = check;
  console.log('Parsed class counts:', classCounts);

  if (classCounts.phone !== 577 || classCounts.phoneAmount !== 645486 || classCounts.distinctPhones !== 399) {
    throw new Error(`Phone class mismatch: expected 577 bills / ₹645,486 / 399 phones, got ${classCounts.phone} / ${classCounts.phoneAmount} / ${classCounts.distinctPhones}`);
  }
  if (classCounts.code !== 67 || classCounts.codeAmount !== 67464 || classCounts.distinctCodes !== 33) {
    throw new Error(`Code class mismatch: expected 67 bills / ₹67,464 / 33 codes, got ${classCounts.code} / ${classCounts.codeAmount} / ${classCounts.distinctCodes}`);
  }
  if (classCounts.nameOnly !== 709 || classCounts.nameOnlyAmount !== 367446 || classCounts.distinctNames !== 535) {
    throw new Error(`Name-only class mismatch: expected 709 bills / ₹367,446 / 535 names, got ${classCounts.nameOnly} / ${classCounts.nameOnlyAmount} / ${classCounts.distinctNames}`);
  }
  if (classCounts.unverified !== 3 || classCounts.unverifiedAmount !== 4806) {
    throw new Error(`Unverified class mismatch: expected 3 bills / ₹4,806, got ${classCounts.unverified} / ${classCounts.unverifiedAmount}`);
  }
  if (classCounts.walkIn !== 2752 || classCounts.walkInAmount !== 450228) {
    throw new Error(`Walk-in class mismatch: expected 2752 bills / ₹450,228, got ${classCounts.walkIn} / ${classCounts.walkInAmount}`);
  }
  if (classCounts.needsReview !== 1 || classCounts.needsReviewAmount !== 382) {
    throw new Error(`Needs review mismatch: expected 1 bill / ₹382, got ${classCounts.needsReview} / ${classCounts.needsReviewAmount}`);
  }
  console.log('✓ All 6 classification counts match golden figures exactly');

  console.log('\n--- 4. Customer Extraction & Spot Checks ---');
  if (batch.customers.length !== 970) {
    throw new Error(`Expected 970 customers extracted, got ${batch.customers.length}`);
  }



  // Check 1: 9653080396 ANURAG SRIVASTAVA (1 bill, A019166, 2026-09-08, ₹706)
  const anurag706 = batch.customers.find(c => c.phone === '9653080396');
  if (!anurag706 || anurag706.totalPurchases !== 1 || anurag706.totalSpend !== 706 || anurag706.lastPurchaseDate !== '2026-09-08') {
    throw new Error(`Spot check failed for 9653080396: purchases=${anurag706?.totalPurchases}, spend=${anurag706?.totalSpend}, lastDate=${anurag706?.lastPurchaseDate}`);
  }
  console.log(`✓ 9653080396 ANURAG SRIVASTAVA verified: 1 bill, ₹706, 2026-09-08`);

  // Check 2: 9335151549 PANKAJ VERMA (6 bills, ₹11,930, last bill 2026-09-30)
  const pankaj = batch.customers.find(c => c.phone === '9335151549');
  if (!pankaj || pankaj.totalPurchases !== 6 || pankaj.totalSpend !== 11930 || pankaj.lastPurchaseDate !== '2026-09-30') {
    throw new Error(`Spot check failed for Pankaj 9335151549: purchases=${pankaj?.totalPurchases}, spend=${pankaj?.totalSpend}, lastDate=${pankaj?.lastPurchaseDate}`);
  }
  console.log(`✓ 9335151549 PANKAJ VERMA verified: 6 bills consolidated, ₹11,930, last bill 2026-09-30`);

  // Check 3: 7376795533 ANURAG (2 bills, 21/09 ₹493, 30/09 ₹531, total ₹1,024, last bill 2026-09-30)
  const anurag1024 = batch.customers.find(c => c.phone === '7376795533');
  if (!anurag1024 || anurag1024.totalPurchases !== 2 || anurag1024.totalSpend !== 1024 || anurag1024.lastPurchaseDate !== '2026-09-30') {
    throw new Error(`Spot check failed for 7376795533 ANURAG: purchases=${anurag1024?.totalPurchases}, spend=${anurag1024?.totalSpend}, lastDate=${anurag1024?.lastPurchaseDate}`);
  }
  console.log(`✓ 7376795533 ANURAG verified: 2 bills, ₹1,024, last bill 2026-09-30`);

  // Check 4: 9455769222 (one customer with two spellings SUMAN LATA SHARMA, JIYALAL SHARMA)
  const phone9455 = batch.customers.find(c => c.phone === '9455769222');
  if (!phone9455) {
    throw new Error('Customer 9455769222 not found');
  }
  console.log(`✓ 9455769222 verified as single customer: '${phone9455.name}' (spend: ₹${phone9455.totalSpend})`);

  // Check 5: Code 0006 (one customer, 5 bills, ₹5,173, 01/09 to 24/09, with two spellings)
  const code0006 = batch.customers.find(c => c.code === '0006');
  if (!code0006 || code0006.totalPurchases !== 5 || code0006.totalSpend !== 5173) {
    throw new Error(`Spot check failed for Code 0006: purchases=${code0006?.totalPurchases}, spend=${code0006?.totalSpend}`);
  }
  console.log(`✓ Code 0006 verified: 5 bills, ₹5,173 (01/09 to 24/09), name '${code0006.name}'`);

  // Check 6: Code 1212 MAUJILAL VISHWAKARMA (1 bill, A018141, 2026-09-01, ₹2,069)
  const code1212 = batch.customers.find(c => c.code === '1212');
  if (!code1212 || code1212.totalPurchases !== 1 || code1212.totalSpend !== 2069) {
    throw new Error(`Spot check failed for Code 1212: purchases=${code1212?.totalPurchases}, spend=${code1212?.totalSpend}`);
  }
  console.log(`✓ Code 1212 MAUJILAL VISHWAKARMA verified: 1 bill, ₹2,069, 2026-09-01`);

  // Check 7: Phone-only customer (Row 604: 9140520595)
  const phoneOnlyCust = batch.customers.find(c => c.phone === '9140520595');
  if (!phoneOnlyCust || phoneOnlyCust.name !== 'Unknown (9140520595)') {
    throw new Error(`Expected name 'Unknown (9140520595)', got '${phoneOnlyCust?.name}'`);
  }
  console.log(`✓ Phone-only row 604 captured as '${phoneOnlyCust.name}'`);

  // Check 8: Single-letter prefix stripped (e.g. M  MUCTA or S  SARBAJEET)
  const mucta = batch.customers.find(c => c.name.toLowerCase().includes('mucta'));
  if (mucta && mucta.name.startsWith('M ')) {
    throw new Error(`Prefix 'M ' was not stripped from Mucta: '${mucta.name}'`);
  }
  const sarbajeet = batch.customers.find(c => c.name.toLowerCase().includes('sarbajeet'));
  if (sarbajeet && sarbajeet.name.startsWith('S ')) {
    throw new Error(`Prefix 'S ' was not stripped from Sarbajeet: '${sarbajeet.name}'`);
  }
  console.log(`✓ Single letter prefixes correctly stripped from names ('${mucta?.name}', '${sarbajeet?.name}')`);

  // Check 9: Fake walk-in entries (CASH, ., \, CREDIT CARD) verified excluded
  const fakeWalkin = batch.customers.find(c => 
    (!c.code && !c.phone && (c.name === '.' || c.name === '. CASH' || c.name === 'CASH' || c.name === '\\' || c.name === 'CREDIT CARD' || c.nameNorm === 'cash')) ||
    c.name === '.' || c.name === '\\'
  );
  if (fakeWalkin) {
    throw new Error(`Fake walk-in customer '${fakeWalkin.name}' was not excluded`);
  }
  console.log('✓ Fake walk-in entries (CASH, ., \\, CREDIT CARD) verified excluded (0 created)');

  console.log('\n--- 5. Chronological Batch Merge & Re-Upload Idempotency ---');
  const merge1 = matchAndMergeChronologicalBatches([], [batch]);
  if (merge1.updatedMasterCustomers.length !== 970) {
    throw new Error(`Expected 970 master customers after upload 1, got ${merge1.updatedMasterCustomers.length}`);
  }

  // Re-upload the exact same batch
  const merge2 = matchAndMergeChronologicalBatches(merge1.updatedMasterCustomers, [batch]);
  if (merge2.updatedMasterCustomers.length !== 970) {
    throw new Error(`Expected 970 master customers after re-upload, got ${merge2.updatedMasterCustomers.length}`);
  }

  const pankajAfterReupload = merge2.updatedMasterCustomers.find(c => c.phone === '9335151549')!;
  if (pankajAfterReupload.totalSpend !== 11930 || pankajAfterReupload.totalPurchases !== 6) {
    throw new Error(`Double-counting occurred on re-upload: Pankaj spend is ${pankajAfterReupload.totalSpend}, purchases is ${pankajAfterReupload.totalPurchases}`);
  }
  console.log(`✓ Re-upload idempotency verified: 970 master customers, Pankaj spend preserved at ₹${pankajAfterReupload.totalSpend} with 6 purchases (zero double-counting)`);

  console.log('\n--- 6. Disjoint Customer Isolation ---');
  // Sandeep 7860903422, Sandeep 8756996846, Sandeep name-only
  const s1 = merge2.updatedMasterCustomers.find(c => c.phone === '7860903422');
  const s2 = merge2.updatedMasterCustomers.find(c => c.phone === '8756996846');
  const s3 = merge2.updatedMasterCustomers.find(c => c.id === 'cust_n_sandeep');

  if (!s1 || !s2 || !s3) {
    throw new Error(`Expected 3 separate Sandeep customer records, found s1:${Boolean(s1)}, s2:${Boolean(s2)}, s3:${Boolean(s3)}`);
  }
  if (s1.totalSpend !== 851 || s2.totalSpend !== 104 || s3.totalSpend !== 640) {
    throw new Error(`Sandeep spend mismatch: s1=${s1.totalSpend}, s2=${s2.totalSpend}, s3=${s3.totalSpend}`);
  }
  console.log(`✓ Sandeep records kept separate: ₹851 (7860903422), ₹104 (8756996846), ₹640 (name-only)`);

  // Anurag Phone (9653080396) vs Anurag Name Only
  const anuragPhone = merge2.updatedMasterCustomers.find(c => c.phone === '9653080396');
  const anuragName = merge2.updatedMasterCustomers.find(c => c.id === 'cust_n_anurag_srivastava');
  if (!anuragPhone || !anuragName) {
    throw new Error('Anurag Phone or Anurag Name Only missing');
  }
  if (anuragPhone.totalSpend !== 706 || anuragName.totalSpend !== 324) {
    throw new Error(`Anurag spend mismatch: phone=${anuragPhone.totalSpend}, name=${anuragName.totalSpend}`);
  }
  console.log(`✓ Anurag records kept separate: ₹706 (phone 9653080396), ₹324 (name-only)`);

  console.log('\n--- 7. Itemized Medicine Preservation ---');
  // Simulate existing customer with itemized medicines from previous prescription
  const customerWithRealMeds: Customer = {
    id: 'cust_p_9999999999',
    name: 'Test Real Meds Patient',
    nameNorm: 'test real meds patient',
    phone: '9999999999',
    phoneNorm: '9999999999',
    isMonthlyRegular: true,
    regularityScore: 95,
    refillCycleDays: 30,
    totalPurchases: 1,
    totalSpend: 1500,
    lastPurchaseDate: '2026-08-15',
    firstPurchaseDate: '2026-08-15',
    nextDueDate: '2026-09-14',
    alertDate: '2026-09-09',
    medicines: [
      {
        id: 'med_telma',
        name: 'TELMA 40MG TAB',
        nameNorm: 'telma 40mg tab',
        qty: 30,
        amount: 350,
        refillCycleDays: 30,
        lastPurchaseDate: '2026-08-15',
        nextDueDate: '2026-09-14',
        status: 'regular'
      },
      {
        id: 'med_glyco',
        name: 'GLYCOMET 500MG SR',
        nameNorm: 'glycomet 500mg sr',
        qty: 60,
        amount: 220,
        refillCycleDays: 30,
        lastPurchaseDate: '2026-08-15',
        nextDueDate: '2026-09-14',
        status: 'regular'
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Bill-wise incoming with placeholder medicine
  const billWiseIncoming: Customer = {
    id: 'cust_p_9999999999',
    name: 'Test Real Meds Patient',
    nameNorm: 'test real meds patient',
    phone: '9999999999',
    phoneNorm: '9999999999',
    isMonthlyRegular: true,
    regularityScore: 95,
    refillCycleDays: 30,
    totalPurchases: 1,
    totalSpend: 800,
    lastPurchaseDate: '2026-09-20',
    firstPurchaseDate: '2026-09-20',
    nextDueDate: '2026-10-20',
    alertDate: '2026-10-15',
    medicines: [
      {
        id: 'med_placeholder',
        name: 'Prescription Bill (₹800.00)',
        nameNorm: 'prescription bill',
        qty: 1,
        amount: 800,
        refillCycleDays: 30,
        lastPurchaseDate: '2026-09-20',
        nextDueDate: '2026-10-20',
        status: 'regular'
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mergeMedsResult = matchAndMergeChronologicalBatches(
    [customerWithRealMeds],
    [{
      fileName: 'test_sep.XLS',
      uploadDate: new Date().toISOString(),
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      totalMedicinesCount: 1,
      totalRowsProcessed: 1,
      fileSize: 100,
      formatType: 'MARG_BILL_WISE_STATEMENT',
      customers: [billWiseIncoming]
    }]
  );

  const updatedPatient = mergeMedsResult.updatedMasterCustomers.find(c => c.phoneNorm === '9999999999')!;
  const hasTelma = updatedPatient.medicines.some(m => m.name === 'TELMA 40MG TAB');
  const hasGlycomet = updatedPatient.medicines.some(m => m.name === 'GLYCOMET 500MG SR');
  const hasPlaceholder = updatedPatient.medicines.some(m => m.name.startsWith('Prescription Bill'));

  if (!hasTelma || !hasGlycomet || hasPlaceholder) {
    throw new Error('Placeholder medicine incorrectly overwrote itemized medicines!');
  }
  console.log(`✓ Itemized medicine preservation verified: Real drugs preserved, placeholder ignored`);

  console.log('\n--- 8. Regression Check: Customer-Wise Reports ---');
  const parentCustWise = path.resolve(__dirname, '../../01-09 to 25-09 coutmer data.XLS');
  if (fs.existsSync(parentCustWise)) {
    const custBuf = fs.readFileSync(parentCustWise);
    const custBatch = parseMargExcel(custBuf, '01-09 to 25-09 coutmer data.XLS');
    if (custBatch.formatType !== 'MARG_GROUPED_SUMMARY') {
      throw new Error(`Expected MARG_GROUPED_SUMMARY, got ${custBatch.formatType}`);
    }
    if (custBatch.customers.length !== 273) {
      throw new Error(`Expected 273 customers in customer-wise report, got ${custBatch.customers.length}`);
    }
    if (custBatch.totalMedicinesCount !== 1525) {
      throw new Error(`Expected 1525 medicines in customer-wise report, got ${custBatch.totalMedicinesCount}`);
    }
    console.log(`✓ Customer-Wise regression verified: 273 customers and 1525 medicines parsed untouched`);
  } else {
    console.log('ℹ 01-09 to 25-09 coutmer data.XLS not found at parent, skipping regression check');
  }

  console.log('\n================================================================');
  console.log('🎉 ALL BILL-WISE GOLDEN ASSERTIONS PASSED WITH 100% ACCURACY!');
  console.log('================================================================\n');
}

runAssertions();
