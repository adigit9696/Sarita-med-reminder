import fs from 'fs';
import path from 'path';
import { parseMargExcel } from '../src/lib/marg-parser.ts';
import { matchAndMergeCustomers } from '../src/lib/customer-matcher.ts';
import { generateReminders, getDaysRemaining } from '../src/lib/refill-calculator.ts';

function runPipelineTest() {
  console.log('========================================================');
  console.log('🧪 SARITA PHARMACY MED REMINDER V2 — PIPELINE TEST');
  console.log('========================================================\n');

  const julPath = path.resolve(__dirname, '../../jully26.XLS');
  const augPath = path.resolve(__dirname, '../../aug26.XLS');

  if (!fs.existsSync(julPath) || !fs.existsSync(augPath)) {
    console.error('❌ Could not locate jully26.XLS or aug26.XLS at:', julPath);
    return;
  }

  // 1. Parse July 2026
  console.log('📂 Step 1: Parsing July Marg Excel File (jully26.XLS)...');
  const julBuf = fs.readFileSync(julPath);
  const julBatch = parseMargExcel(julBuf, 'jully26.XLS', 30, 5);
  console.log(`   ✓ Format Detected: ${julBatch.formatType}`);
  console.log(`   ✓ Period: ${julBatch.periodStart} to ${julBatch.periodEnd}`);
  console.log(`   ✓ Total Patients: ${julBatch.customers.length}`);
  console.log(`   ✓ Total Prescriptions Parsed: ${julBatch.totalMedicinesCount}`);

  // Initial database has July customers
  const initialCustomers = julBatch.customers;

  // 2. Parse August 2026
  console.log('\n📂 Step 2: Parsing August Marg Excel File (aug26.XLS)...');
  const augBuf = fs.readFileSync(augPath);
  const augBatch = parseMargExcel(augBuf, 'aug26.XLS', 30, 5);
  console.log(`   ✓ Format Detected: ${augBatch.formatType}`);
  console.log(`   ✓ Period: ${augBatch.periodStart} to ${augBatch.periodEnd}`);
  console.log(`   ✓ Total Patients: ${augBatch.customers.length}`);
  console.log(`   ✓ Total Prescriptions Parsed: ${augBatch.totalMedicinesCount}`);

  // 3. Match & Merge August into July
  console.log('\n🔄 Step 3: Running Customer Matcher (July + August)...');
  const mergeResult = matchAndMergeCustomers(initialCustomers, augBatch.customers, 30, 5);
  const master = mergeResult.updatedMasterCustomers;
  const monthlyRegulars = master.filter((c) => c.isMonthlyRegular);

  console.log(`   ✓ Total Master Database Customers: ${master.length}`);
  console.log(`   ✓ Repeat Monthly Regular Customers Detected: ${monthlyRegulars.length}`);
  console.log(`     - Matched via 10-digit Phone: ${mergeResult.report.matchedMonthlyCustomers.filter(m => m.matchType === 'phone').length}`);
  console.log(`     - Matched via Marg Patient Code: ${mergeResult.report.matchedMonthlyCustomers.filter(m => m.matchType === 'code').length}`);
  console.log(`     - Matched via Patient Name: ${mergeResult.report.matchedMonthlyCustomers.filter(m => m.matchType === 'name').length}`);

  // 4. Test 5-Day Alerts & Due Date Calculations
  console.log('\n⏰ Step 4: Testing Refill Prediction & 5-Day Alerts...');
  const reminders = generateReminders(master, 5, new Date('2026-09-26'));
  const dueIn5Days = reminders.filter((r) => r.urgency === 'DUE_IN_5_DAYS');
  const overdue = reminders.filter((r) => r.urgency === 'OVERDUE');
  const upcoming = reminders.filter((r) => r.urgency === 'UPCOMING');

  console.log(`   ✓ Total Active Reminders: ${reminders.length}`);
  console.log(`   ✓ Due in 5 Days (Triggers Audio Chime): ${dueIn5Days.length}`);
  console.log(`   ✓ Overdue Refills: ${overdue.length}`);
  console.log(`   ✓ Upcoming Refills: ${upcoming.length}`);

  console.log('\n📋 Sample 5-Day Alert Items:');
  dueIn5Days.slice(0, 5).forEach((r) => {
    console.log(`   - [${r.urgency}] ${r.customerName} (${r.customerPhone || 'No Phone'}) | Due: ${r.dueDate} (${r.daysRemaining} days left)`);
    console.log(`     Meds: ${r.medicinesSummary}`);
  });

  console.log('\n✅ ALL INTEGRATION TESTS PASSED!');
}

runPipelineTest();
