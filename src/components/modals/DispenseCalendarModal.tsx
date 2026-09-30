'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, X, Clock, AlertTriangle, AlertCircle, Pill, ArrowRight } from 'lucide-react';
import type { Customer } from '@/types';
import { getDaysRemaining } from '@/lib/refill-calculator';

interface DispenseCalendarModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customerId: string, dispensedDate: string, cycleDays?: number) => void;
  defaultCycleDays?: number;
}

export const DispenseCalendarModal: React.FC<DispenseCalendarModalProps> = ({
  customer,
  isOpen,
  onClose,
  onConfirm,
  defaultCycleDays = 30,
}) => {
  const getLocalToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const todayStr = getLocalToday();
  const [dispensedDate, setDispensedDate] = useState<string>(todayStr);
  const [cycleDays, setCycleDays] = useState<number>(() => {
    if (customer?.refillCycleDays && customer.refillCycleDays > 0) return customer.refillCycleDays;
    const cDays = customer?.medicines?.[0]?.refillCycleDays;
    return cDays && cDays > 0 ? cDays : (defaultCycleDays || 30);
  });

  useEffect(() => {
    if (isOpen) {
      setDispensedDate(getLocalToday());
      if (customer?.refillCycleDays && customer.refillCycleDays > 0) {
        setCycleDays(customer.refillCycleDays);
      } else {
        const cDays = customer?.medicines?.[0]?.refillCycleDays;
        setCycleDays(cDays && cDays > 0 ? cDays : (defaultCycleDays || 30));
      }
    }
  }, [isOpen, customer, defaultCycleDays]);

  if (!isOpen || !customer) return null;

  // Calculate next due date and alert date based on selected dispensed date and manual cycle days
  const activeCycle = cycleDays > 0 ? cycleDays : defaultCycleDays;

  const calcNextDueDate = () => {
    if (!dispensedDate) return '';
    const parts = dispensedDate.split('-').map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return '';
    const dt = new Date(parts[0], parts[1] - 1, parts[2] + activeCycle);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const calcAlertDate = () => {
    const nextDue = calcNextDueDate();
    if (!nextDue) return '';
    const parts = nextDue.split('-').map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return '';
    const dt = new Date(parts[0], parts[1] - 1, parts[2] - 5);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const nextDueDate = calcNextDueDate();
  const alertDate = calcAlertDate();
  const daysRemaining = nextDueDate ? getDaysRemaining(nextDueDate) : activeCycle;

  const handleQuickSelect = (daysOffset: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysOffset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dt = String(d.getDate()).padStart(2, '0');
    setDispensedDate(`${y}-${m}-${dt}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispensedDate) {
      alert('Please select a valid dispensed date');
      return;
    }
    if (!cycleDays || cycleDays <= 0) {
      alert('Please enter a valid refill cycle in days (e.g. 15, 17, 30)');
      return;
    }
    onConfirm(customer.id, dispensedDate, cycleDays);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 leading-tight">
                Select Medication Dispensed Date
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Set exact dispensed date and refill cycle to start the reminder countdown
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Customer Summary Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-900 text-sm block">
                {customer.name}
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                {customer.phone ? `Phone: ${customer.phone}` : 'No Phone'} {customer.code ? `· Code: ${customer.code}` : ''}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
              {customer.medicines.length} Medicines
            </span>
          </div>

          {/* Calendar Date Picker Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              Dispensed Date (When patient received medicines):
            </label>
            <div className="relative">
              <input
                type="date"
                required
                value={dispensedDate}
                onChange={(e) => setDispensedDate(e.target.value)}
                className="w-full bg-slate-50 border-2 border-teal-500/80 p-2.5 rounded-xl text-slate-900 font-medium text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Quick Action Chips */}
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              <span className="text-[11px] text-slate-500 font-medium mr-1">Quick Select:</span>
              <button
                type="button"
                onClick={() => handleQuickSelect(0)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  dispensedDate === todayStr 
                    ? 'bg-teal-600 text-white' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect(1)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect(2)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                2 Days Ago
              </button>
              <button
                type="button"
                onClick={() => handleQuickSelect(3)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                3 Days Ago
              </button>
            </div>
          </div>

          {/* Refill Duration (Staff Controlled) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">
                Refill Duration:
              </label>
              <span className="text-[11px] text-teal-700 font-semibold">
                Select duration or type custom days
              </span>
            </div>
            
            {/* Quick preset chips */}
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: '15 days', days: 15 },
                { label: '1 month', days: 30 },
                { label: '2 months', days: 60 },
                { label: '3 months', days: 90 },
              ].map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setCycleDays(opt.days)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition-all text-center border ${
                    cycleDays === opt.days
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Custom number of days */}
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Custom days:</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  min={1}
                  max={365}
                  required
                  value={cycleDays || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setCycleDays(isNaN(val) ? 0 : val);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 p-2 pr-14 rounded-xl text-slate-900 font-bold text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  placeholder="e.g. 15, 30, 45"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                  Days
                </span>
              </div>
            </div>
          </div>

          {/* Next Cycle Timeline Preview */}
          <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 text-xs space-y-2.5">
            <h4 className="font-bold text-teal-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              <span>Calculated Reminder Schedule:</span>
            </h4>
            <div className="grid grid-cols-2 gap-3 text-slate-700">
              <div className="bg-white p-2.5 rounded-lg border border-teal-100">
                <span className="text-[10px] text-slate-500 font-medium block">Next Refill Due Date:</span>
                <span className="font-mono font-bold text-slate-900 text-xs mt-0.5 block">
                  {nextDueDate || '—'}
                </span>
                <span className="text-[10px] text-teal-700 font-semibold mt-0.5 block">
                  ({activeCycle} days cycle)
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-teal-100">
                <span className="text-[10px] text-slate-500 font-medium block">Alert Mode Starts:</span>
                <span className="font-mono font-bold text-amber-700 text-xs mt-0.5 block">
                  {alertDate || '—'}
                </span>
                <span className="text-[10px] text-amber-800 font-medium mt-0.5 block">
                  (5 days advance chime & push alert)
                </span>
              </div>
            </div>
            <div className="text-[11px] text-teal-800 font-medium pt-1">
              {daysRemaining > 5 ? (
                <span className="flex items-center gap-1.5 text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Customer will be marked <strong className="text-emerald-700">Complete</strong> and countdown will begin at <strong className="text-slate-900">{daysRemaining} days</strong> left.</span>
                </span>
              ) : daysRemaining >= 0 ? (
                <span className="flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Selected date falls within <strong className="text-amber-800">Alert Mode ({daysRemaining} days left)</strong>.</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-rose-900">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>Selected date means refill is <strong className="text-rose-700">Overdue by {Math.abs(daysRemaining)} days</strong>.</span>
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-1 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm & Set Countdown</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
