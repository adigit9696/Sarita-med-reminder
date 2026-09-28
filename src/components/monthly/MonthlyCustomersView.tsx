'use client';

import React, { useState } from 'react';
import { 
  CalendarClock, 
  Search, 
  Phone, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ExternalLink,
  Pill,
  Sparkles,
  ArrowUpDown,
  Bell,
  Calendar
} from 'lucide-react';
import type { Customer } from '@/types';
import { getDaysRemaining } from '@/lib/refill-calculator';
import { formatWhatsAppReminderMessage, openWhatsAppChat } from '@/lib/whatsapp';
import { DispenseCalendarModal } from '../modals/DispenseCalendarModal';

interface MonthlyCustomersViewProps {
  customers: Customer[];
  onSelectCustomer: (cust: Customer) => void;
  onMarkRefilled: (customerId: string) => void;
  onRecordDispensedDate?: (customerId: string, dispensedDate: string, cycleDays?: number) => void;
  whatsappTemplate: string;
}

export const MonthlyCustomersView: React.FC<MonthlyCustomersViewProps> = ({
  customers,
  onSelectCustomer,
  onMarkRefilled,
  onRecordDispensedDate,
  whatsappTemplate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETED'>('ALL');
  const [calendarCustomer, setCalendarCustomer] = useState<Customer | null>(null);

  // Filter only regular monthly customers
  const monthlyCustomers = customers.filter((c) => c.isMonthlyRegular);

  const filtered = monthlyCustomers.filter((c) => {
    const days = getDaysRemaining(c.nextDueDate);
    if (statusFilter === 'DUE_SOON' && !(days >= 0 && days <= 5)) return false;
    if (statusFilter === 'OVERDUE' && !(days < 0)) return false;
    if (statusFilter === 'COMPLETED' && !(days > 5)) return false;

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const nameMatch = c.name.toLowerCase().includes(term);
    const phoneMatch = c.phone?.includes(term);
    const medMatch = c.medicines.some((m) => m.name.toLowerCase().includes(term));
    return nameMatch || phoneMatch || medMatch;
  });

  // Sorting logic required by Point 2:
  // 1. Overdue (< 0 days) at top
  // 2. Alert Mode (0 to 5 days) next
  // 3. Upcoming normal (6 to 25 days)
  // 4. Complete / Refilled (> 25 days) automatically move to the bottom of the list
  const sorted = [...filtered].sort((a, b) => {
    const daysA = getDaysRemaining(a.nextDueDate);
    const daysB = getDaysRemaining(b.nextDueDate);

    const getRank = (days: number) => {
      if (days < 0) return 0; // Overdue
      if (days <= 5) return 1; // Alert Mode
      if (days <= 25) return 2; // Upcoming
      return 3; // Complete / Just Refilled (Bottom of list)
    };

    const rankA = getRank(daysA);
    const rankB = getRank(daysB);

    if (rankA !== rankB) return rankA - rankB;
    return daysA - daysB;
  });

  const handleWhatsApp = (cust: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    let phone = cust.phone;
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      const entered = prompt(`Enter 10-digit WhatsApp number for ${cust.name}:`, phone || '');
      if (!entered) return;
      phone = entered;
    }
    const msg = formatWhatsAppReminderMessage(
      whatsappTemplate,
      cust.name,
      cust.medicines,
      cust.nextDueDate
    );

    const ok = openWhatsAppChat(phone, msg);
    if (!ok) {
      alert('Please enter a valid 10-digit mobile number.');
    }
  };

  const handleCall = (cust: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cust.phone) {
      alert('Patient does not have a registered mobile number.');
      return;
    }
    window.location.href = `tel:${cust.phone}`;
  };

  const handleRefillClick = (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkRefilled(customerId);
  };

  const alertModeCount = monthlyCustomers.filter((c) => {
    const d = getDaysRemaining(c.nextDueDate);
    return d >= 0 && d <= 5;
  }).length;

  const overdueCount = monthlyCustomers.filter((c) => getDaysRemaining(c.nextDueDate) < 0).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <CalendarClock className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Monthly Customers Directory
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">
              {monthlyCustomers.length} Regular Patients
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            These customers appear every month in Marg ERP sales reports. When marked "Refilled", their status marks Complete, their 30-day countdown begins, and they move to the bottom of the list. They automatically re-enter Alert Mode 5 days before their due date.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search monthly patient or med..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-2 rounded-xl text-xs focus:bg-white focus:border-teal-500 transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as unknown as typeof statusFilter)}
            className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 focus:border-teal-500"
          >
            <option value="ALL">All ({monthlyCustomers.length})</option>
            <option value="DUE_SOON">Alert Mode ({alertModeCount})</option>
            <option value="OVERDUE">Overdue ({overdueCount})</option>
            <option value="COMPLETED">Complete / Countdown</option>
          </select>
        </div>
      </div>

      {/* Monthly Customers List */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {sorted.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarClock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">
              {monthlyCustomers.length === 0 
                ? 'No Monthly Customers Selected Yet' 
                : 'No Customers Match Search Criteria'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {monthlyCustomers.length === 0
                ? 'Go to "All Customers" and tick "Track Monthly" next to any patient to add them to this monthly roster.'
                : 'Try adjusting your search terms or filter.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-3 w-12 text-center">#</th>
                    <th className="py-3.5 px-5">Customer Name & Code</th>
                    <th className="py-3.5 px-4">Contact Phone</th>
                    <th className="py-3.5 px-4">Regular Medicines Prescribed</th>
                    <th className="py-3.5 px-4">Refill Due Status</th>
                    <th className="py-3.5 px-4">Last Refill / Bought</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sorted.map((cust, idx) => {
                    const days = getDaysRemaining(cust.nextDueDate);
                    const isOverdue = days < 0;
                    const isAlertMode = days >= 0 && days <= 5;
                    const isComplete = days > 5;

                    return (
                      <tr
                        key={cust.id}
                        onClick={() => onSelectCustomer(cust)}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                          isComplete ? 'bg-slate-50/40 opacity-90' : ''
                        }`}
                      >
                        <td className="py-3.5 px-3 text-center text-slate-400 font-mono font-medium text-xs">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">
                              {cust.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                              {cust.regularityScore}%
                            </span>
                          </div>
                          {cust.code && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Marg Code: {cust.code}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">
                          {cust.phone ? (
                            <span className="font-semibold">{cust.phone}</span>
                          ) : (
                            <span className="text-slate-400 italic">No Phone</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 max-w-sm">
                          <div className="flex flex-wrap gap-1">
                            {cust.medicines.slice(0, 3).map((m, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] border border-slate-200/60 truncate max-w-[150px]"
                                title={m.name}
                              >
                                {m.name}
                              </span>
                            ))}
                            {cust.medicines.length > 3 && (
                              <span className="px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 text-[10px] font-bold">
                                +{cust.medicines.length - 3} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td 
                          className="py-3.5 px-4"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCalendarCustomer(cust);
                          }}
                        >
                          <button
                            type="button"
                            title="Click to select exact medication dispensed date in calendar"
                            className="group/cal text-left transition-transform hover:scale-[1.02] focus:outline-none"
                          >
                            {isOverdue ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 hover:bg-rose-200 hover:border-rose-300 shadow-2xs">
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                                <Calendar className="w-3.5 h-3.5 text-rose-700 group-hover/cal:scale-110 transition-transform" />
                                <span>Overdue by {Math.abs(days)}d ({cust.nextDueDate})</span>
                              </div>
                            ) : isAlertMode ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200 hover:border-amber-300 shadow-2xs animate-pulse-subtle">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                <Calendar className="w-3.5 h-3.5 text-amber-800 group-hover/cal:scale-110 transition-transform" />
                                <span>Alert Mode: Due in {days}d ({cust.nextDueDate})</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 shadow-2xs">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <Calendar className="w-3.5 h-3.5 text-emerald-700 group-hover/cal:scale-110 transition-transform" />
                                <span>Complete (Refill in {days}d · {cust.nextDueDate})</span>
                              </div>
                            )}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-500">
                          {cust.lastRefillDate || cust.lastPurchaseDate}
                        </td>
                        <td 
                          className="py-3.5 px-5 text-right space-x-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => handleCall(cust, e)}
                            title="Phone Call"
                            disabled={!cust.phone}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition-colors inline-flex items-center"
                          >
                            <Phone className="w-3.5 h-3.5 text-teal-600" />
                          </button>
                          <button
                            onClick={(e) => handleWhatsApp(cust, e)}
                            title="Send WhatsApp Refill Alert"
                            disabled={!cust.phone}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 disabled:opacity-40 transition-colors inline-flex items-center"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                          {isComplete ? (
                            <button
                              onClick={() => setCalendarCustomer(cust)}
                              title="Refill Complete — Click to select medication dispensed date in calendar."
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium text-xs shadow-2xs transition-colors inline-flex items-center gap-1"
                            >
                              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Complete</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setCalendarCustomer(cust)}
                              title="Click to select exact medication dispensed date in calendar"
                              className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs shadow-2xs transition-colors inline-flex items-center gap-1"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Refilled</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Responsive Cards View */}
            <div className="lg:hidden divide-y divide-slate-100">
              {sorted.map((cust, idx) => {
                const days = getDaysRemaining(cust.nextDueDate);
                const isOverdue = days < 0;
                const isAlertMode = days >= 0 && days <= 5;
                const isComplete = days > 5;

                return (
                  <div
                    key={cust.id}
                    onClick={() => onSelectCustomer(cust)}
                    className={`p-4 hover:bg-slate-50/80 transition-colors cursor-pointer space-y-3 ${
                      isComplete ? 'bg-slate-50/40 opacity-90' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-400 font-medium">#{idx + 1}</span>
                          <span className="font-bold text-sm text-slate-900">{cust.name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                            {cust.regularityScore}%
                          </span>
                        </div>
                        {cust.code && (
                          <span className="text-[10px] text-slate-400 font-mono block">Marg: {cust.code}</span>
                        )}
                      </div>

                      {/* Calendar Trigger Status Pill */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCalendarCustomer(cust);
                        }}
                        className="text-right focus:outline-none"
                      >
                        {isOverdue ? (
                          <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                            Overdue {Math.abs(days)}d
                          </span>
                        ) : isAlertMode ? (
                          <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            Due {days}d
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                            Refill {days}d
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Medicines snippet */}
                    <div className="flex flex-wrap gap-1">
                      {cust.medicines.slice(0, 3).map((m, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] border border-slate-200/60 truncate max-w-[140px]"
                        >
                          {m.name}
                        </span>
                      ))}
                      {cust.medicines.length > 3 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 text-[10px] font-bold">
                          +{cust.medicines.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Mobile Card Action Bar */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => handleCall(cust, e)}
                          title="Phone Call"
                          disabled={!cust.phone}
                          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition-colors inline-flex items-center gap-1 text-xs"
                        >
                          <Phone className="w-3.5 h-3.5 text-teal-600" />
                          <span className="font-mono text-[11px]">{cust.phone ? cust.phone.slice(-10) : 'No phone'}</span>
                        </button>
                        <button
                          onClick={(e) => handleWhatsApp(cust, e)}
                          title="WhatsApp Reminder"
                          disabled={!cust.phone}
                          className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 disabled:opacity-40 transition-colors inline-flex items-center"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        </button>
                      </div>

                      {isComplete ? (
                        <button
                          onClick={() => setCalendarCustomer(cust)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium text-xs shadow-2xs transition-colors inline-flex items-center gap-1.5"
                        >
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Complete</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setCalendarCustomer(cust)}
                          className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs shadow-2xs transition-colors inline-flex items-center gap-1.5"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Refilled</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Dispensed Date Calendar Modal */}
      <DispenseCalendarModal
        customer={calendarCustomer}
        isOpen={!!calendarCustomer}
        onClose={() => setCalendarCustomer(null)}
        onConfirm={(customerId, dispensedDate, cycleDays) => {
          if (onRecordDispensedDate) {
            onRecordDispensedDate(customerId, dispensedDate, cycleDays);
          } else {
            onMarkRefilled(customerId);
          }
        }}
      />
    </div>
  );
};
