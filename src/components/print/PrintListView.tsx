'use client';

import React, { useState, useMemo } from 'react';
import { 
  Printer, 
  Calendar, 
  Phone, 
  PhoneOff,
  ArrowUpDown, 
  Search, 
  Sparkles, 
  RotateCcw, 
  AlertTriangle,
} from 'lucide-react';
import type { Customer, ReminderItem } from '@/types';
import { BRAND } from '@/lib/brand.config';
import { getDaysRemaining } from '@/lib/refill-calculator';

interface PrintListViewProps {
  customers: Customer[];
  reminders: ReminderItem[];
}

export type PrintMode = 'CALL_SHEET' | 'DELIVERY_LABELS';
export type DateTarget = 'BILL_DATE' | 'DUE_DATE';
export type CustomerScope = 'MONTHLY' | 'ALL';
export type PhoneFilter = 'ALL' | 'WITH_PHONE' | 'NO_PHONE';
export type SortOption = 'DATE_ASC' | 'DATE_DESC' | 'AMOUNT_DESC' | 'NAME_ASC';
export type PresetKey = 
  | 'WEEK_1' 
  | 'DAYS_1_10' 
  | 'DAYS_11_20' 
  | 'DAYS_21_END' 
  | 'FULL_MONTH' 
  | 'DUE_5_DAYS' 
  | 'OVERDUE' 
  | 'ALL' 
  | 'CUSTOM';

interface PrintCustomerRow {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerCode?: string;
  billDate: string; // ISO date YYYY-MM-DD
  dueDate: string;  // ISO date YYYY-MM-DD
  primaryDate: string; // The date being sorted/filtered (billDate or dueDate)
  daysRemaining: number;
  urgency: 'OVERDUE' | 'DUE_IN_5_DAYS' | 'UPCOMING';
  periodSpend: number;
  totalSpend: number;
  medicinesList: string[];
  isMonthlyRegular: boolean;
  hasPhone: boolean;
}

function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY format
  }
  return isoDate;
}

function getLastDayOfMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) return '30';
  const lastDay = new Date(y, m, 0).getDate();
  return String(lastDay).padStart(2, '0');
}

export const PrintListView: React.FC<PrintListViewProps> = ({
  customers,
  reminders,
}) => {
  // 1. Detect uploaded months in the dataset
  const { detectedMonth, availableMonths } = useMemo(() => {
    const monthCounts: Record<string, number> = {};
    for (const c of customers) {
      if (c.lastPurchaseDate && c.lastPurchaseDate.length >= 7) {
        const ym = c.lastPurchaseDate.slice(0, 7);
        monthCounts[ym] = (monthCounts[ym] || 0) + 1;
      }
    }
    const months = Object.keys(monthCounts).sort().reverse();
    let bestMonth = '';
    let maxCount = 0;
    for (const [ym, count] of Object.entries(monthCounts)) {
      if (count > maxCount) {
        maxCount = count;
        bestMonth = ym;
      }
    }
    const fallback = new Date().toISOString().slice(0, 7);
    return {
      detectedMonth: bestMonth || fallback,
      availableMonths: months.length > 0 ? months : [fallback],
    };
  }, [customers]);

  // View & Filter States
  const [printMode, setPrintMode] = useState<PrintMode>('CALL_SHEET');
  const [dateTarget, setDateTarget] = useState<DateTarget>('BILL_DATE');
  const [customerScope, setCustomerScope] = useState<CustomerScope>('MONTHLY');
  const [phoneFilter, setPhoneFilter] = useState<PhoneFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('DATE_ASC');
  const [activeMonth, setActiveMonth] = useState<string>(detectedMonth);
  const [activePreset, setActivePreset] = useState<PresetKey>('WEEK_1');
  
  // Default to 01-09 to 06-09 for the detected month
  const [startDate, setStartDate] = useState<string>(`${detectedMonth}-01`);
  const [endDate, setEndDate] = useState<string>(`${detectedMonth}-06`);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Map reminders for fast lookup
  const remindersMap = useMemo(() => {
    return new Map<string, ReminderItem>(reminders.map((r) => [r.customerId, r]));
  }, [reminders]);

  // Handler for preset button clicks
  const applyPreset = (preset: PresetKey, targetMonth: string = activeMonth) => {
    setActivePreset(preset);
    const lastDay = getLastDayOfMonth(targetMonth);

    switch (preset) {
      case 'WEEK_1':
        setDateTarget('BILL_DATE');
        setStartDate(`${targetMonth}-01`);
        setEndDate(`${targetMonth}-06`);
        break;
      case 'DAYS_1_10':
        setDateTarget('BILL_DATE');
        setStartDate(`${targetMonth}-01`);
        setEndDate(`${targetMonth}-10`);
        break;
      case 'DAYS_11_20':
        setDateTarget('BILL_DATE');
        setStartDate(`${targetMonth}-11`);
        setEndDate(`${targetMonth}-20`);
        break;
      case 'DAYS_21_END':
        setDateTarget('BILL_DATE');
        setStartDate(`${targetMonth}-21`);
        setEndDate(`${targetMonth}-${lastDay}`);
        break;
      case 'FULL_MONTH':
        setDateTarget('BILL_DATE');
        setStartDate(`${targetMonth}-01`);
        setEndDate(`${targetMonth}-${lastDay}`);
        break;
      case 'DUE_5_DAYS': {
        setDateTarget('DUE_DATE');
        const today = new Date();
        const start = today.toISOString().slice(0, 10);
        const endD = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);
        const end = endD.toISOString().slice(0, 10);
        setStartDate(start);
        setEndDate(end);
        break;
      }
      case 'OVERDUE': {
        setDateTarget('DUE_DATE');
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        setStartDate('2025-01-01');
        setEndDate(yesterday);
        break;
      }
      case 'ALL':
        setStartDate('');
        setEndDate('');
        break;
      case 'CUSTOM':
        // Keep current dates
        break;
    }
  };

  // Handler when staff changes month dropdown
  const handleMonthChange = (newMonth: string) => {
    setActiveMonth(newMonth);
    applyPreset(activePreset === 'CUSTOM' ? 'WEEK_1' : activePreset, newMonth);
  };

  // Handler for manual date input changes
  const handleDateChange = (type: 'start' | 'end', value: string) => {
    setActivePreset('CUSTOM');
    if (type === 'start') {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
  };

  // Reset all filters to default
  const handleResetFilters = () => {
    setDateTarget('BILL_DATE');
    setCustomerScope('MONTHLY');
    setPhoneFilter('ALL');
    setSortBy('DATE_ASC');
    setSearchQuery('');
    applyPreset('WEEK_1', detectedMonth);
    setActiveMonth(detectedMonth);
  };

  // 2. Compute Filtered and Sorted Customer Rows
  const processedRows = useMemo(() => {
    const rows: PrintCustomerRow[] = [];

    for (const cust of customers) {
      // Scope Filter: Monthly Regulars (≥ ₹1,000) vs All
      if (customerScope === 'MONTHLY' && !cust.isMonthlyRegular) {
        continue;
      }

      const reminder = remindersMap.get(cust.id);
      const primaryBillDate = cust.lastPurchaseDate || '';
      const primaryDueDate = cust.nextDueDate || '';

      const daysRemaining = reminder?.daysRemaining ?? (primaryDueDate ? getDaysRemaining(primaryDueDate) : 999);
      const urgency: 'OVERDUE' | 'DUE_IN_5_DAYS' | 'UPCOMING' =
        reminder?.urgency ?? (daysRemaining < 0 ? 'OVERDUE' : daysRemaining <= 5 ? 'DUE_IN_5_DAYS' : 'UPCOMING');

      const hasPhone = Boolean(cust.phone && cust.phone.trim().length > 0);

      // Phone Filter: All vs With Phone vs No Phone
      if (phoneFilter === 'WITH_PHONE' && !hasPhone) continue;
      if (phoneFilter === 'NO_PHONE' && hasPhone) continue;

      let matchesDate = false;
      let effectiveBillDate = primaryBillDate;
      let effectiveDueDate = primaryDueDate;
      let periodSpend = cust.totalSpend || 0;
      let effectiveMedicines: string[] = cust.medicines.map(m => m.name);

      if (!startDate && !endDate) {
        // No date restriction
        matchesDate = true;
      } else if (dateTarget === 'BILL_DATE') {
        // Check if customer made purchases between [startDate, endDate]
        // 1. Check purchase records in history
        const matchingPurchases = (cust.history || []).filter(h => {
          if (!h.date) return false;
          if (startDate && h.date < startDate) return false;
          if (endDate && h.date > endDate) return false;
          return true;
        });

        // 2. Check primary lastPurchaseDate
        const lastPurchaseMatches = Boolean(
          primaryBillDate &&
          (!startDate || primaryBillDate >= startDate) &&
          (!endDate || primaryBillDate <= endDate)
        );

        // 3. Check medicines lastPurchaseDate
        const matchingMeds = (cust.medicines || []).filter(m => {
          if (!m.lastPurchaseDate) return false;
          if (startDate && m.lastPurchaseDate < startDate) return false;
          if (endDate && m.lastPurchaseDate > endDate) return false;
          return true;
        });

        if (matchingPurchases.length > 0) {
          matchesDate = true;
          const sortedPurchases = [...matchingPurchases].sort((a, b) => b.date.localeCompare(a.date));
          effectiveBillDate = sortedPurchases[0].date;
          const sum = matchingPurchases.reduce((acc, p) => acc + (p.amount || 0), 0);
          if (sum > 0) periodSpend = sum;
          const distinctItems = Array.from(new Set(matchingPurchases.map(p => p.item).filter(Boolean)));
          if (distinctItems.length > 0) effectiveMedicines = distinctItems;
        } else if (lastPurchaseMatches) {
          matchesDate = true;
          effectiveBillDate = primaryBillDate;
        } else if (matchingMeds.length > 0) {
          matchesDate = true;
          const sortedMeds = [...matchingMeds].sort((a, b) => b.lastPurchaseDate.localeCompare(a.lastPurchaseDate));
          effectiveBillDate = sortedMeds[0].lastPurchaseDate;
          effectiveMedicines = matchingMeds.map(m => m.name);
        }
      } else {
        // dateTarget === 'DUE_DATE'
        // Check if customer's refill due date falls between [startDate, endDate]
        const dueDateMatches = Boolean(
          primaryDueDate &&
          (!startDate || primaryDueDate >= startDate) &&
          (!endDate || primaryDueDate <= endDate)
        );

        if (dueDateMatches) {
          matchesDate = true;
          effectiveDueDate = primaryDueDate;
        }
      }

      if (!matchesDate) continue;

      // Search Query Filter
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = cust.name.toLowerCase().includes(query);
        const phoneMatch = cust.phone?.includes(query) ?? false;
        const codeMatch = cust.code?.toLowerCase().includes(query) ?? false;
        const medMatch = effectiveMedicines.some(m => m.toLowerCase().includes(query));
        if (!nameMatch && !phoneMatch && !codeMatch && !medMatch) {
          continue;
        }
      }

      if (effectiveMedicines.length === 0) {
        effectiveMedicines = [`Prescription Bill (₹${periodSpend.toFixed(2)})`];
      }

      const primaryDate = dateTarget === 'BILL_DATE' ? effectiveBillDate : effectiveDueDate;

      rows.push({
        id: cust.id,
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: cust.phone,
        customerCode: cust.code,
        billDate: effectiveBillDate,
        dueDate: effectiveDueDate,
        primaryDate,
        daysRemaining,
        urgency,
        periodSpend,
        totalSpend: cust.totalSpend || 0,
        medicinesList: effectiveMedicines,
        isMonthlyRegular: cust.isMonthlyRegular,
        hasPhone,
      });
    }

    // 3. Sorting ("allows staff to sort customers by date and generate a new list")
    rows.sort((a, b) => {
      if (sortBy === 'DATE_ASC') {
        // Earliest date first
        const cmp = (a.primaryDate || '9999').localeCompare(b.primaryDate || '9999');
        if (cmp !== 0) return cmp;
        return b.periodSpend - a.periodSpend;
      }
      if (sortBy === 'DATE_DESC') {
        // Latest date first
        const cmp = (b.primaryDate || '0000').localeCompare(a.primaryDate || '0000');
        if (cmp !== 0) return cmp;
        return b.periodSpend - a.periodSpend;
      }
      if (sortBy === 'AMOUNT_DESC') {
        // Highest spend first
        const cmp = b.periodSpend - a.periodSpend;
        if (cmp !== 0) return cmp;
        return (a.primaryDate || '').localeCompare(b.primaryDate || '');
      }
      if (sortBy === 'NAME_ASC') {
        return a.customerName.localeCompare(b.customerName);
      }
      return 0;
    });

    return rows;
  }, [
    customers, 
    customerScope, 
    phoneFilter, 
    startDate, 
    endDate, 
    dateTarget, 
    searchQuery, 
    sortBy, 
    remindersMap
  ]);

  // Statistics for the current filtered view
  const stats = useMemo(() => {
    const totalCount = processedRows.length;
    const withPhoneCount = processedRows.filter(r => r.hasPhone).length;
    const noPhoneCount = totalCount - withPhoneCount;
    const totalAmount = processedRows.reduce((acc, r) => acc + r.periodSpend, 0);

    // Count in current date range for both scopes to show on toggle badge
    const monthlyCount = customers.filter(c => c.isMonthlyRegular).length;
    const allCount = customers.length;

    return {
      totalCount,
      withPhoneCount,
      noPhoneCount,
      totalAmount,
      monthlyCount,
      allCount,
    };
  }, [processedRows, customers]);

  const handlePrint = () => {
    window.print();
  };

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const dateFilterLabel = useMemo(() => {
    if (!startDate && !endDate) return 'All Dates (Full Dataset)';
    const startStr = formatDateDisplay(startDate);
    const endStr = formatDateDisplay(endDate);
    const targetStr = dateTarget === 'BILL_DATE' ? 'Bill Dates' : 'Refill Due Dates';
    return `${targetStr}: ${startStr} to ${endStr}`;
  }, [startDate, endDate, dateTarget]);

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* ACTION & FILTER CONTROL BAR (Strictly Hidden on Print)          */}
      {/* ============================================================== */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5 no-print">
        {/* Top Header & Primary Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-100">
                <Printer className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Printable Staff Call Sheets & Medicine Bag Slips
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate date-sorted call sheets for pharmacy owner and staff follow-ups, with physical pen checkboxes.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-xl border border-slate-200/90 p-1 bg-slate-50 text-xs">
              <button
                type="button"
                onClick={() => setPrintMode('CALL_SHEET')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
                  printMode === 'CALL_SHEET'
                    ? 'bg-white text-teal-800 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Call Sheet (Table)
              </button>
              <button
                type="button"
                onClick={() => setPrintMode('DELIVERY_LABELS')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
                  printMode === 'DELIVERY_LABELS'
                    ? 'bg-white text-teal-800 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Delivery Bag Slips
              </button>
            </div>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 active:scale-98 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1"
            >
              <Printer className="w-4 h-4" />
              <span>Print (A4) / Save as PDF</span>
            </button>
          </div>
        </div>

        {/* Control Section 1: Date Filter Target & Quick Date Presets */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                <span>Filter By:</span>
              </span>

              {/* Date Target Toggle */}
              <div className="inline-flex rounded-xl border border-slate-200/90 p-0.5 bg-slate-50 text-xs">
                <button
                  type="button"
                  onClick={() => setDateTarget('BILL_DATE')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
                    dateTarget === 'BILL_DATE'
                      ? 'bg-teal-700 text-white font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Filter customers whose bills were purchased in this date range"
                >
                  Bill / Purchase Date
                </button>
                <button
                  type="button"
                  onClick={() => setDateTarget('DUE_DATE')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
                    dateTarget === 'DUE_DATE'
                      ? 'bg-teal-700 text-white font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Filter customers whose refills are due in this date range"
                >
                  Refill Due Date
                </button>
              </div>

              {/* Uploaded Month Selector (if multiple months available) */}
              {availableMonths.length > 1 && (
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-[11px] text-slate-400 font-medium">Month:</span>
                  <select
                    value={activeMonth}
                    onChange={(e) => handleMonthChange(e.target.value)}
                    className="bg-slate-50 border border-slate-200/90 text-slate-800 text-xs rounded-lg px-2.5 py-1 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                  >
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Quick Reset Button */}
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-slate-500 hover:text-teal-700 flex items-center gap-1 self-start sm:self-auto transition-colors duration-150 font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Presets:</span>
            
            <button
              type="button"
              onClick={() => applyPreset('WEEK_1')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                activePreset === 'WEEK_1'
                  ? 'bg-teal-50 border-teal-500 text-teal-800 shadow-2xs ring-1 ring-teal-500'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              01–06 (Week 1)
            </button>

            <button
              type="button"
              onClick={() => applyPreset('DAYS_1_10')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
                activePreset === 'DAYS_1_10'
                  ? 'bg-teal-50 border-teal-500 text-teal-800 shadow-2xs ring-1 ring-teal-500'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              01–10 (Early Month)
            </button>

            <button
              type="button"
              onClick={() => applyPreset('DAYS_11_20')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
                activePreset === 'DAYS_11_20'
                  ? 'bg-teal-50 border-teal-500 text-teal-800 shadow-2xs ring-1 ring-teal-500'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              11–20 (Mid Month)
            </button>

            <button
              type="button"
              onClick={() => applyPreset('DAYS_21_END')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
                activePreset === 'DAYS_21_END'
                  ? 'bg-teal-50 border-teal-500 text-teal-800 shadow-2xs ring-1 ring-teal-500'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              21–End (Late Month)
            </button>

            <button
              type="button"
              onClick={() => applyPreset('FULL_MONTH')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
                activePreset === 'FULL_MONTH'
                  ? 'bg-teal-50 border-teal-500 text-teal-800 shadow-2xs ring-1 ring-teal-500'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Full Uploaded Month
            </button>

            <button
              type="button"
              onClick={() => applyPreset('DUE_5_DAYS')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
                activePreset === 'DUE_5_DAYS'
                  ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-2xs ring-1 ring-amber-500 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Due Next 5 Days
            </button>

            <button
              type="button"
              onClick={() => applyPreset('OVERDUE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
                activePreset === 'OVERDUE'
                  ? 'bg-red-50 border-red-500 text-red-800 shadow-2xs ring-1 ring-red-500 font-semibold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Overdue Only
            </button>

            <button
              type="button"
              onClick={() => applyPreset('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
                activePreset === 'ALL'
                  ? 'bg-slate-100 border-slate-400 text-slate-900 shadow-2xs font-semibold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              All Dates
            </button>
          </div>

          {/* Date Picker Range Inputs */}
          <div className="flex items-center gap-3 pt-1 flex-wrap bg-slate-50/70 p-3 rounded-xl border border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <span className="text-slate-500">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleDateChange('start', e.target.value)}
                className="bg-white border border-slate-200/90 px-2.5 py-1.5 rounded-lg text-xs text-slate-800 font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <span className="text-slate-500">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleDateChange('end', e.target.value)}
                className="bg-white border border-slate-200/90 px-2.5 py-1.5 rounded-lg text-xs text-slate-800 font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
              />
            </div>

            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Selected Range: <strong className="text-slate-800 font-mono">{formatDateDisplay(startDate)}</strong> to{' '}
              <strong className="text-slate-800 font-mono">{formatDateDisplay(endDate)}</strong>
            </span>
          </div>
        </div>

        {/* Control Section 2: Scope, Phone Filter, Sorting & Search */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* 1. Customer Scope */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Customer Roster Scope
            </label>
            <select
              value={customerScope}
              onChange={(e) => setCustomerScope(e.target.value as CustomerScope)}
              className="w-full bg-slate-50 border border-slate-200/90 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            >
              <option value="MONTHLY">
                Monthly Regulars (≥ ₹1,000) ({stats.monthlyCount})
              </option>
              <option value="ALL">
                All Customers (Full Directory) ({stats.allCount})
              </option>
            </select>
          </div>

          {/* 2. Phone Filter (Explicit User Requirement) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Phone Availability
            </label>
            <select
              value={phoneFilter}
              onChange={(e) => setPhoneFilter(e.target.value as PhoneFilter)}
              className="w-full bg-slate-50 border border-slate-200/90 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            >
              <option value="ALL">All (With & Without Phone)</option>
              <option value="WITH_PHONE">With Phone Number Only</option>
              <option value="NO_PHONE">Without Phone Number Only</option>
            </select>
          </div>

          {/* 3. Sort Options ("allows staff to sort customers by date and generate a new list") */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-teal-600" />
              <span>Sort List By</span>
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full bg-slate-50 border border-slate-200/90 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            >
              <option value="DATE_ASC">Date: Earliest First (01 → 30)</option>
              <option value="DATE_DESC">Date: Latest First (30 → 01)</option>
              <option value="AMOUNT_DESC">Bill Amount: High to Low (₹)</option>
              <option value="NAME_ASC">Patient Name (A → Z)</option>
            </select>
          </div>

          {/* 4. Real-time Search */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Quick Filter
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient, phone, item..."
                className="w-full bg-slate-50 border border-slate-200/90 pl-8 pr-3 py-1.5 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
              />
            </div>
          </div>
        </div>

        {/* Live Filter Summary Ribbon */}
        <div className="bg-teal-50/40 border border-teal-200/80 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold text-teal-950 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Showing:</span>
              <span className="text-teal-800 font-mono tabular-nums text-sm font-bold">{stats.totalCount}</span> Patients
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-700 font-medium flex items-center gap-1">
              <Phone className="w-3 h-3 text-emerald-600" />
              <span>With Phone:</span>
              <strong className="text-emerald-700 font-mono tabular-nums">{stats.withPhoneCount}</strong>
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-700 font-medium flex items-center gap-1">
              <PhoneOff className="w-3 h-3 text-amber-600" />
              <span>Without Phone:</span>
              <strong className="text-amber-700 font-mono tabular-nums">{stats.noPhoneCount}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px]">Total Value:</span>
            <span className="font-mono tabular-nums font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-teal-200/80 shadow-2xs">
              ₹{stats.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* PRINTABLE SHEET CONTAINER (A4 Friendly Layout)                 */}
      {/* ============================================================== */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs mb-12 print:m-0 print:p-0 print:border-none print:shadow-none">
        {/* Printable Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {BRAND.pharmacy.name}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {BRAND.pharmacy.address} · Phone: {BRAND.pharmacy.phones.join(', ')}
            </p>
            <div className="mt-1.5">
              <span className="text-xs font-bold text-teal-900 uppercase tracking-wider block">
                {printMode === 'CALL_SHEET'
                  ? `Staff & Owner Follow-Up Call Sheet — ${dateFilterLabel}`
                  : `Customer Delivery Bag Labels — ${dateFilterLabel}`}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Scope: {customerScope === 'MONTHLY' ? 'Monthly Regulars (≥ ₹1,000)' : 'All Billed Customers'} · 
                Sorted by: {
                  sortBy === 'DATE_ASC' ? 'Date (Earliest First)' :
                  sortBy === 'DATE_DESC' ? 'Date (Latest First)' :
                  sortBy === 'AMOUNT_DESC' ? 'Bill Amount (High to Low)' : 'Patient Name (A-Z)'
                }
              </span>
            </div>
          </div>
          <div className="text-right text-xs">
            <span className="font-semibold text-slate-800">Date: {todayFormatted}</span>
            <div className="mt-1 space-y-0.5">
              <span className="block text-slate-700 font-mono text-[11px]">
                Total Listed: <strong>{stats.totalCount}</strong> Patients
              </span>
              <span className="block text-slate-500 text-[10px]">
                (Phone: {stats.withPhoneCount} · No Phone: {stats.noPhoneCount})
              </span>
              <span className="block text-teal-800 font-mono font-bold text-[11px]">
                Total Value: ₹{stats.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {processedRows.length === 0 && (
          <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-xl my-6">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No Customers Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              No customer records match the selected date range ({formatDateDisplay(startDate)} to {formatDateDisplay(endDate)}) and active filters.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-3 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold no-print cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODE 1: CALL SHEET TABLE (Optimized for Pen Checkmarks)        */}
        {/* ============================================================== */}
        {printMode === 'CALL_SHEET' && processedRows.length > 0 && (
          <div className="overflow-x-auto pb-8 print:pb-16">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-800 text-[11px] font-bold text-slate-800 uppercase bg-slate-50/50 print:bg-transparent">
                  <th className="py-2.5 px-3 w-8 text-center">#</th>
                  <th className="py-2.5 px-3 w-48">Patient & Contact</th>
                  <th className="py-2.5 px-3 w-32">Bill Date & Due</th>
                  <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-3">Prescription Items & Pen Tick Checklist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {processedRows.map((row, idx) => (
                  <tr 
                    key={row.id} 
                    className="align-top hover:bg-slate-50/50 print:break-inside-avoid"
                    style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                  >
                    {/* Index */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-700 text-center">
                      {idx + 1}
                    </td>

                    {/* Patient & Contact */}
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900 text-xs">
                        {row.customerName}
                      </p>
                      
                      {row.hasPhone ? (
                        <p className="font-mono text-slate-800 text-[11px] flex items-center gap-1 mt-0.5 font-semibold">
                          <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{row.customerPhone}</span>
                        </p>
                      ) : (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-semibold">
                          ⚠️ No Phone (Walk-in)
                        </span>
                      )}

                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {row.customerCode && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Code: {row.customerCode}
                          </span>
                        )}
                        {row.isMonthlyRegular && (
                          <span className="text-[9px] bg-teal-50 text-teal-700 font-semibold px-1 py-0.2 rounded border border-teal-200 print:border-slate-300">
                            ₹1k+ Regular
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Bill Date & Due Date */}
                    <td className="py-3 px-3 space-y-1">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium">
                          Bill Date:
                        </span>
                        <span className="font-mono font-bold text-slate-900 text-xs">
                          {formatDateDisplay(row.billDate)}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-medium">
                          Next Due:
                        </span>
                        <span className="font-mono text-slate-800 text-xs">
                          {formatDateDisplay(row.dueDate)}
                        </span>
                        <span className="block text-[10px] text-slate-500 font-medium">
                          {row.daysRemaining < 0
                            ? `Overdue by ${Math.abs(row.daysRemaining)}d`
                            : row.daysRemaining === 0
                            ? 'Due today'
                            : `Due in ${row.daysRemaining} days`}
                        </span>
                      </div>
                    </td>

                    {/* Spend / Amount */}
                    <td className="py-3 px-3 text-right">
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        ₹{row.periodSpend.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>

                    {/* Prescription Items & Pen Tick Checklist */}
                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        {row.medicinesList.map((med, mIdx) => (
                          <div 
                            key={mIdx} 
                            className="flex items-start justify-between text-slate-800 text-xs py-0.5 border-b border-slate-100 last:border-none"
                          >
                            <span className="font-medium pr-2">• {med}</span>
                            <span className="text-[10px] text-slate-500 font-mono shrink-0 whitespace-nowrap">
                              [ &nbsp; ] Refill &nbsp;&nbsp; [ &nbsp; ] Not Needed
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Pen Tick Action Line for Staff / Owner */}
                      <div className="mt-2 pt-1 border-t border-dashed border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
                        <span className="font-mono">
                          [ &nbsp; ] Called / Spoke &nbsp;&nbsp; [ &nbsp; ] Delivery Needed
                        </span>
                        <span className="text-slate-400">
                          Follow-up Note: ___________________________
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODE 2: DELIVERY BAG LABELS (Cut & Paste Grid)                 */}
        {/* ============================================================== */}
        {printMode === 'DELIVERY_LABELS' && processedRows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8 print:pb-16">
            {processedRows.map((row, idx) => (
              <div
                key={row.id}
                className="border-2 border-dashed border-slate-400 rounded-xl p-4 text-xs space-y-2 relative bg-white print:break-inside-avoid"
                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
              >
                <div className="flex items-start justify-between border-b border-slate-200 pb-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {row.customerName}
                    </h3>
                    <p className="font-mono text-slate-800 font-semibold text-xs mt-0.5">
                      Phone: {row.customerPhone || 'No Phone (Walk-in)'}
                    </p>
                    {row.customerCode && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        Code: {row.customerCode}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] bg-slate-100 font-bold px-2 py-0.5 rounded border border-slate-200">
                      Bag #{idx + 1}
                    </span>
                    <span className="block text-[10px] font-mono text-slate-600 mt-1">
                      Bill: {formatDateDisplay(row.billDate)}
                    </span>
                    <span className="block text-[10px] font-mono font-bold text-teal-800">
                      Due: {formatDateDisplay(row.dueDate)}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Medicines to Pack:
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900">
                      ₹{row.periodSpend.toFixed(2)}
                    </span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-800 text-[11px]">
                    {row.medicinesList.map((m, mi) => (
                      <li key={mi} className="truncate">{m}</li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500">
                  <span>Packed by: ____________</span>
                  <span>Verified [ &nbsp; ]</span>
                  <span>Date: {formatDateDisplay(row.dueDate)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Print Document Footer */}
        <div className="mt-8 pt-4 border-t border-slate-300 text-center text-[10px] text-slate-400 flex justify-between items-center">
          <span>{BRAND.pharmacy.name} System Report</span>
          <span>{BRAND.tagline}</span>
          <span>Generated on {todayFormatted}</span>
        </div>
      </div>
    </div>
  );
};
