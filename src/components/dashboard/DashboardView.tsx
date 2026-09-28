'use client';

import React, { useState } from 'react';
import { 
  Users, 
  CalendarClock, 
  Bell, 
  AlertTriangle, 
  CheckCircle2, 
  Phone, 
  MessageSquare, 
  Search,
  Filter,
  Volume2,
  Clock,
  ArrowUpRight,
  Pill,
  Sparkles,
  Calendar
} from 'lucide-react';
import type { Customer, ReminderItem } from '@/types';
import { audioAlerts } from '@/lib/audio-alerts';
import { formatWhatsAppReminderMessage, openWhatsAppChat } from '@/lib/whatsapp';
import { DispenseCalendarModal } from '../modals/DispenseCalendarModal';

interface DashboardViewProps {
  customers: Customer[];
  reminders: ReminderItem[];
  onSelectCustomer: (cust: Customer) => void;
  onMarkRefilled: (customerId: string) => void;
  onRecordDispensedDate?: (customerId: string, dispensedDate: string, cycleDays?: number) => void;
  onUpdateStatus: (reminderId: string, status: ReminderItem['status']) => void;
  whatsappTemplate: string;
  searchQuery?: string;
  onClearSearch?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  customers,
  reminders,
  onSelectCustomer,
  onMarkRefilled,
  onRecordDispensedDate,
  onUpdateStatus,
  whatsappTemplate,
  searchQuery = '',
  onClearSearch,
}) => {
  const [activeFilter, setActiveFilter] = useState<'ACTION_TODAY' | 'DUE_5_DAYS' | 'OVERDUE' | 'CALLED' | 'PENDING'>('ACTION_TODAY');
  const [calendarCustomer, setCalendarCustomer] = useState<Customer | null>(null);

  const monthlyCustomers = customers.filter((c) => c.isMonthlyRegular);
  const dueIn5Days = reminders.filter((r) => r.urgency === 'DUE_IN_5_DAYS' && r.status === 'pending');
  const overdue = reminders.filter((r) => r.urgency === 'OVERDUE' && r.status === 'pending');
  const actionToday = reminders.filter((r) => (r.urgency === 'DUE_IN_5_DAYS' || r.urgency === 'OVERDUE') && r.status === 'pending');

  const queryLower = searchQuery.toLowerCase().trim();

  const filteredReminders = reminders.filter((r) => {
    if (activeFilter === 'ACTION_TODAY') {
      if (!((r.urgency === 'DUE_IN_5_DAYS' || r.urgency === 'OVERDUE') && r.status === 'pending')) return false;
    } else if (activeFilter === 'DUE_5_DAYS') {
      if (!(r.urgency === 'DUE_IN_5_DAYS' && r.status === 'pending')) return false;
    } else if (activeFilter === 'OVERDUE') {
      if (!(r.urgency === 'OVERDUE' && r.status === 'pending')) return false;
    } else if (activeFilter === 'CALLED') {
      if (!(r.status === 'called' || r.status === 'confirmed')) return false;
    } else if (activeFilter === 'PENDING') {
      if (r.status !== 'pending') return false;
    }

    if (queryLower) {
      const matchName = r.customerName.toLowerCase().includes(queryLower);
      const matchPhone = r.customerPhone ? r.customerPhone.includes(queryLower) : false;
      const matchCode = r.customerCode ? r.customerCode.toLowerCase().includes(queryLower) : false;
      const matchMed = r.medicinesSummary.toLowerCase().includes(queryLower) ||
        r.medicinesList.some(m => m.toLowerCase().includes(queryLower));
      if (!matchName && !matchPhone && !matchCode && !matchMed) return false;
    }

    return true;
  });

  const handlePlayRefillSound = () => {
    audioAlerts.playFiveDayRefillAlert();
  };

  const handleWhatsApp = (r: ReminderItem) => {
    let phone = r.customerPhone;
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      const entered = prompt(`Enter 10-digit WhatsApp number for ${r.customerName}:`, phone || '');
      if (!entered) return;
      phone = entered;
    }
    const cust = customers.find((c) => c.id === r.customerId);
    const meds = cust?.medicines || r.medicinesList.map((name) => ({ name }));
    const msg = formatWhatsAppReminderMessage(
      whatsappTemplate,
      r.customerName,
      meds,
      r.dueDate
    );

    const ok = openWhatsAppChat(phone, msg);
    if (!ok) {
      alert('Please enter a valid 10-digit mobile number.');
    }
  };

  const handleCall = (r: ReminderItem) => {
    if (!r.customerPhone) {
      alert('Patient does not have a registered mobile number.');
      return;
    }
    window.location.href = `tel:${r.customerPhone}`;
  };

  return (
    <div className="space-y-6">
      {/* 5-Day Refill Alert Notification Banner */}
      {actionToday.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-lg shadow-amber-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-white animate-bell-ring" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide">
                Refill Alert: {dueIn5Days.length} Monthly Customers Due in Next 5 Days
                {overdue.length > 0 && ` (${overdue.length} Overdue)`}
              </h3>
              <p className="text-xs text-amber-100 mt-0.5">
                Reach out to these patients today so their chronic prescriptions never lapse.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handlePlayRefillSound}
              className="px-3.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-xs flex items-center gap-1.5 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Chime Alert</span>
            </button>
            <button
              onClick={() => setActiveFilter('DUE_5_DAYS')}
              className="px-3.5 py-1.5 rounded-lg bg-white text-amber-900 hover:bg-amber-50 text-xs font-bold transition-colors shadow-xs"
            >
              View Due List
            </button>
          </div>
        </div>
      )}

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Monthly Customers */}
        <div 
          onClick={() => setActiveFilter('ACTION_TODAY')}
          className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-teal-400 transition-all shadow-2xs hover:shadow-md cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Monthly Customers
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {monthlyCustomers.length}
          </p>
          <p className="text-[11px] text-teal-600 font-medium mt-1">
            Repeat monthly prescription buyers
          </p>
        </div>

        {/* Card 2: Due in 5 Days */}
        <div 
          onClick={() => setActiveFilter('DUE_5_DAYS')}
          className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-amber-400 transition-all shadow-2xs hover:shadow-md cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Due in 5 Days
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">
            {dueIn5Days.length}
          </p>
          <p className="text-[11px] text-amber-700 font-medium mt-1">
            Action required within 5 days
          </p>
        </div>

        {/* Card 3: Overdue */}
        <div 
          onClick={() => setActiveFilter('OVERDUE')}
          className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-rose-400 transition-all shadow-2xs hover:shadow-md cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Overdue Refills
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-colors">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2">
            {overdue.length}
          </p>
          <p className="text-[11px] text-rose-600 font-medium mt-1">
            Past due date — call immediately
          </p>
        </div>

        {/* Card 4: Total All Customers */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 transition-all shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              All Registered
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {customers.length}
          </p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            Stored across all monthly uploads
          </p>
        </div>
      </div>

      {/* Action Today Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {/* Table Header & Filter Chips */}
        <div className="p-5 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>Action Today — Refill Reminders</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Patients needing medication replenishment ordered by urgency
            </p>
          </div>

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveFilter('ACTION_TODAY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeFilter === 'ACTION_TODAY'
                  ? 'bg-teal-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Action Today ({actionToday.length})
            </button>
            <button
              onClick={() => setActiveFilter('DUE_5_DAYS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeFilter === 'DUE_5_DAYS'
                  ? 'bg-amber-500 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Due 5 Days ({dueIn5Days.length})
            </button>
            <button
              onClick={() => setActiveFilter('OVERDUE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeFilter === 'OVERDUE'
                  ? 'bg-rose-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Overdue ({overdue.length})
            </button>
            <button
              onClick={() => setActiveFilter('PENDING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeFilter === 'PENDING'
                  ? 'bg-slate-800 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Pending ({reminders.filter(r => r.status === 'pending').length})
            </button>
          </div>
        </div>

        {/* Reminders Table */}
        {filteredReminders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              No Pending Reminders for Selected Filter
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              All monthly patients have received their refills or are not due yet.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-3 w-12 text-center">#</th>
                    <th className="py-3.5 px-5">Patient Name</th>
                    <th className="py-3.5 px-4">Contact</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Status & Days Left</th>
                    <th className="py-3.5 px-4">Medicines List</th>
                    <th className="py-3.5 px-5 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReminders.map((rem, idx) => {
                    const cust = customers.find((c) => c.id === rem.customerId);
                    const isOverdue = rem.daysRemaining < 0;
                    const is5Days = rem.daysRemaining >= 0 && rem.daysRemaining <= 5;

                    return (
                      <tr
                        key={rem.id}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        onClick={() => cust && onSelectCustomer(cust)}
                      >
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-5 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{rem.customerName}</span>
                            {cust?.isMonthlyRegular && (
                              <span className="w-2 h-2 rounded-full bg-teal-500" title="Monthly Regular Patient"></span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {rem.customerPhone ? (
                            <span>{rem.customerPhone}</span>
                          ) : (
                            <span className="text-slate-400 italic">No Phone</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">
                          {rem.dueDate}
                        </td>
                        <td 
                          className="py-3.5 px-4"
                          onClick={(e) => {
                            e.stopPropagation();
                            const targetCust = cust || customers.find(c => c.id === rem.customerId);
                            if (targetCust) setCalendarCustomer(targetCust);
                          }}
                        >
                          <div className="flex flex-col gap-1 items-start">
                            <button
                              type="button"
                              title="Click to select medication dispensed date in calendar"
                              className="group/cal text-left transition-transform hover:scale-105 focus:outline-none"
                            >
                              {isOverdue ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 hover:bg-rose-200 shadow-2xs">
                                  <Calendar className="w-3 h-3 text-rose-700 group-hover/cal:scale-110 transition-transform" />
                                  <span>Overdue by {Math.abs(rem.daysRemaining)}d</span>
                                </span>
                              ) : is5Days ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200 shadow-2xs">
                                  <Calendar className="w-3 h-3 text-amber-800 group-hover/cal:scale-110 transition-transform" />
                                  <span>Due in {rem.daysRemaining}d</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 shadow-2xs">
                                  <Calendar className="w-3 h-3 text-slate-500 group-hover/cal:scale-110 transition-transform" />
                                  <span>In {rem.daysRemaining} days</span>
                                </span>
                              )}
                            </button>

                            {rem.status === 'pending' ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-2.5 h-2.5 text-amber-600" />
                                <span>Pending</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Complete</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs truncate text-slate-600">
                          {rem.medicinesSummary}
                        </td>
                        <td 
                          className="py-3.5 px-5 text-right space-x-1.5 whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleCall(rem)}
                            title="Call Patient"
                            disabled={!rem.customerPhone}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition-colors inline-flex items-center"
                          >
                            <Phone className="w-3.5 h-3.5 text-teal-600" />
                          </button>
                          <button
                            onClick={() => handleWhatsApp(rem)}
                            title="Send WhatsApp Reminder"
                            disabled={!rem.customerPhone}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 disabled:opacity-40 transition-colors inline-flex items-center"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                          <button
                            onClick={() => {
                              const targetCust = cust || customers.find(c => c.id === rem.customerId);
                              if (targetCust) setCalendarCustomer(targetCust);
                            }}
                            title="Select dispensed date in calendar"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors inline-flex items-center"
                          >
                            <Calendar className="w-3.5 h-3.5 text-teal-600" />
                          </button>
                          <button
                            onClick={() => {
                              onMarkRefilled(rem.customerId);
                            }}
                            title="Mark task as Complete (Refilled)"
                            className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-2xs transition-colors inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Complete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredReminders.map((rem, idx) => {
                const cust = customers.find((c) => c.id === rem.customerId);
                const isOverdue = rem.daysRemaining < 0;
                const is5Days = rem.daysRemaining >= 0 && rem.daysRemaining <= 5;

                return (
                  <div
                    key={rem.id}
                    className="p-4 hover:bg-slate-50/80 transition-colors space-y-3 cursor-pointer"
                    onClick={() => cust && onSelectCustomer(cust)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-400 font-medium">#{idx + 1}</span>
                          <span className="font-bold text-sm text-slate-900">{rem.customerName}</span>
                          {cust?.isMonthlyRegular && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                              Monthly
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[11px] text-slate-500 font-mono">
                            Due: {rem.dueDate}
                          </p>
                          {rem.status === 'pending' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-2.5 h-2.5 text-amber-600" />
                              <span>Pending</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Complete</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Clickable Calendar Status Pill */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const targetCust = cust || customers.find(c => c.id === rem.customerId);
                          if (targetCust) setCalendarCustomer(targetCust);
                        }}
                        className="text-right focus:outline-none"
                      >
                        {isOverdue ? (
                          <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                            Overdue {Math.abs(rem.daysRemaining)}d
                          </span>
                        ) : is5Days ? (
                          <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            Due {rem.daysRemaining}d
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-lg text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1">
                            In {rem.daysRemaining}d
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Medicines preview */}
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">
                      <span className="font-semibold text-slate-700">Meds: </span>
                      {rem.medicinesSummary}
                    </p>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCall(rem)}
                          title="Call Patient"
                          disabled={!rem.customerPhone}
                          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 transition-colors inline-flex items-center gap-1 text-xs"
                        >
                          <Phone className="w-3.5 h-3.5 text-teal-600" />
                          <span className="font-mono text-[11px]">{rem.customerPhone ? rem.customerPhone.slice(-10) : 'No phone'}</span>
                        </button>
                        <button
                          onClick={() => handleWhatsApp(rem)}
                          title="WhatsApp Reminder"
                          disabled={!rem.customerPhone}
                          className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 disabled:opacity-40 transition-colors inline-flex items-center"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const targetCust = cust || customers.find(c => c.id === rem.customerId);
                            if (targetCust) setCalendarCustomer(targetCust);
                          }}
                          title="Select exact dispensed date in calendar"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors inline-flex items-center"
                        >
                          <Calendar className="w-3.5 h-3.5 text-teal-600" />
                        </button>
                        <button
                          onClick={() => onMarkRefilled(rem.customerId)}
                          title="Mark task as Complete (Refilled)"
                          className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-2xs transition-colors inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Complete</span>
                        </button>
                      </div>
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
