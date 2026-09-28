'use client';

import React, { useState } from 'react';
import { 
  Printer, 
  FileText, 
  Scissors, 
  Calendar, 
  Filter, 
  CheckSquare,
  Sparkles,
  Phone
} from 'lucide-react';
import type { Customer, ReminderItem } from '@/types';
import { BRAND } from '@/lib/brand.config';

interface PrintListViewProps {
  customers: Customer[];
  reminders: ReminderItem[];
}

export const PrintListView: React.FC<PrintListViewProps> = ({
  customers,
  reminders,
}) => {
  const [printMode, setPrintMode] = useState<'CALL_SHEET' | 'DELIVERY_LABELS'>('CALL_SHEET');
  const [filterOption, setFilterOption] = useState<'DUE_5_DAYS' | 'ALL_PENDING' | 'OVERDUE'>('DUE_5_DAYS');

  // Restrict strictly to Monthly Customers (Active Tracking Roster)
  const monthlyCustomerMap = new Map(
    customers.filter((c) => c.isMonthlyRegular).map((c) => [c.id, c])
  );

  const monthlyReminders = reminders.filter((r) => monthlyCustomerMap.has(r.customerId));

  const filteredReminders = monthlyReminders.filter((r) => {
    if (filterOption === 'DUE_5_DAYS') return r.urgency === 'DUE_IN_5_DAYS' && r.status === 'pending';
    if (filterOption === 'OVERDUE') return r.urgency === 'OVERDUE' && r.status === 'pending';
    return r.status === 'pending';
  });

  const handlePrint = () => {
    window.print();
  };

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Action Bar (hidden on print) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Printer className="w-5 h-5 text-teal-600" />
            <span>Printable Staff Call Sheets & Medicine Bag Slips</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Optimized for physical A4 printing (Black & White friendly) for pharmacy staff to call patients and tick items with a pen.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode Selector */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
            <button
              onClick={() => setPrintMode('CALL_SHEET')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                printMode === 'CALL_SHEET'
                  ? 'bg-white text-teal-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Call Sheet
            </button>
            <button
              onClick={() => setPrintMode('DELIVERY_LABELS')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                printMode === 'DELIVERY_LABELS'
                  ? 'bg-white text-teal-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Delivery Bag Slips
            </button>
          </div>

          {/* Filter Selector */}
          <select
            value={filterOption}
            onChange={(e) => setFilterOption(e.target.value as unknown as typeof filterOption)}
            className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 focus:border-teal-500"
          >
            <option value="DUE_5_DAYS">Due in Next 5 Days ({monthlyReminders.filter(r => r.urgency === 'DUE_IN_5_DAYS' && r.status === 'pending').length})</option>
            <option value="OVERDUE">Overdue Only ({monthlyReminders.filter(r => r.urgency === 'OVERDUE' && r.status === 'pending').length})</option>
            <option value="ALL_PENDING">All Monthly Active ({monthlyReminders.filter(r => r.status === 'pending').length})</option>
          </select>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print (A4) / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet View */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-8 shadow-xs mb-12 print:mb-20 print:p-2 print:border-none print:shadow-none">
        {/* Printable Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {BRAND.pharmacy.name}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {BRAND.pharmacy.address} · Phone: {BRAND.pharmacy.phones.join(', ')}
            </p>
            <p className="text-xs font-bold text-teal-800 mt-1 uppercase tracking-wider">
              {printMode === 'CALL_SHEET'
                ? `Staff Daily Refill Call Sheet — ${filterOption.replace('_', ' ')}`
                : 'Customer Delivery Bag Labels (Cut & Paste Grid)'}
            </p>
          </div>
          <div className="text-right text-xs">
            <span className="font-semibold text-slate-800">Date: {todayFormatted}</span>
            <span className="block text-slate-500 text-[11px] mt-0.5">
              Total Listed: {filteredReminders.length} Patients
            </span>
          </div>
        </div>

        {/* Mode 1: Call Sheet Table */}
        {printMode === 'CALL_SHEET' && (
          <div className="overflow-x-auto pb-8 print:pb-16">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-800 text-[11px] font-bold text-slate-800 uppercase">
                  <th className="py-2.5 px-3 w-8 text-center">#</th>
                  <th className="py-2.5 px-3 w-48">Patient & Phone</th>
                  <th className="py-2.5 px-3 w-32">Due Date</th>
                  <th className="py-2.5 px-3">Prescription Items & Pen Tick Checklist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredReminders.map((rem, idx) => (
                  <tr key={rem.id} className="align-top hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-mono font-bold text-slate-700 text-center">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900 text-xs">
                        {rem.customerName}
                      </p>
                      <p className="font-mono text-slate-600 text-[11px]">
                        {rem.customerPhone || 'No Phone'}
                      </p>
                      {rem.customerCode && (
                        <p className="text-[10px] text-slate-400 font-mono">
                          Code: {rem.customerCode}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-slate-900">
                        {rem.dueDate}
                      </span>
                      <span className="block text-[10px] text-slate-500">
                        {rem.daysRemaining < 0
                          ? `Overdue by ${Math.abs(rem.daysRemaining)}d`
                          : `Due in ${rem.daysRemaining} days`}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                        {rem.medicinesList.map((med, mIdx) => (
                          <div key={mIdx} className="flex items-center justify-between text-slate-800 text-xs py-0.5 border-b border-slate-100 last:border-none">
                            <span className="font-medium">• {med}</span>
                            <span className="text-[10px] text-slate-500 font-mono ml-2 shrink-0">
                              [  ] Refill &nbsp;&nbsp; [  ] Not Needed
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mode 2: Delivery Slips Grid (Cut & Paste onto Medicine Bags) */}
        {printMode === 'DELIVERY_LABELS' && (
          <div className="grid grid-cols-2 gap-4">
            {filteredReminders.map((rem, idx) => (
              <div
                key={rem.id}
                className="border-2 border-dashed border-slate-400 rounded-xl p-4 text-xs space-y-2 relative bg-white"
              >
                <div className="flex items-start justify-between border-b border-slate-200 pb-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {rem.customerName}
                    </h3>
                    <p className="font-mono text-slate-700 font-semibold text-xs mt-0.5">
                      Phone: {rem.customerPhone || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] bg-slate-100 font-bold px-2 py-0.5 rounded border border-slate-200">
                      Bag #{idx + 1}
                    </span>
                    <span className="block text-[10px] font-mono text-slate-500 mt-1">
                      Due: {rem.dueDate}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Medicines to Pack:
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-800 text-[11px]">
                    {rem.medicinesList.map((m, mi) => (
                      <li key={mi} className="truncate">{m}</li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500">
                  <span>Packed by: ____________</span>
                  <span>Date: {rem.dueDate}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Print Footer */}
        <div className="mt-8 pt-4 border-t border-slate-300 text-center text-[10px] text-slate-400">
          {BRAND.tagline} · {BRAND.pharmacy.name} System Report
        </div>
      </div>
    </div>
  );
};
