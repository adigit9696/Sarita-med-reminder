'use client';

import React from 'react';
import { 
  X, 
  Phone, 
  MessageSquare, 
  Calendar, 
  Pill, 
  Clock, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle,
  History,
  MapPin,
  FileText
} from 'lucide-react';
import type { Customer } from '@/types';
import { audioAlerts } from '@/lib/audio-alerts';
import { formatWhatsAppReminderMessage, openWhatsAppChat } from '@/lib/whatsapp';
import { DispenseCalendarModal } from '../modals/DispenseCalendarModal';

interface CustomerDrawerProps {
  customer: Customer | null;
  onClose: () => void;
  onMarkRefilled: (customerId: string) => void;
  onRecordDispensedDate?: (customerId: string, dispensedDate: string, cycleDays?: number) => void;
  whatsappTemplate: string;
}

export const CustomerDrawer: React.FC<CustomerDrawerProps> = ({
  customer,
  onClose,
  onMarkRefilled,
  onRecordDispensedDate,
  whatsappTemplate,
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  if (!customer) return null;

  const handleWhatsApp = () => {
    let phone = customer.phone;
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      const entered = prompt(`Enter 10-digit WhatsApp number for ${customer.name}:`, phone || '');
      if (!entered) return;
      phone = entered;
    }
    const msg = formatWhatsAppReminderMessage(
      whatsappTemplate,
      customer.name,
      customer.medicines,
      customer.nextDueDate || 'soon'
    );

    const ok = openWhatsAppChat(phone, msg);
    if (!ok) {
      alert('Please enter a valid 10-digit mobile number.');
    }
  };

  const handleCall = () => {
    if (!customer.phone) {
      alert('No mobile number available for this patient.');
      return;
    }
    window.location.href = `tel:${customer.phone}`;
  };

  const handleRefillClick = () => {
    audioAlerts.playSuccessChime();
    onMarkRefilled(customer.id);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-fadeIn">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {customer.name}
              </h2>
              {customer.isMonthlyRegular && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Monthly Regular
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              {customer.phone ? (
                <span className="font-mono">{customer.phone}</span>
              ) : (
                <span className="text-slate-400">No phone attached</span>
              )}
              {customer.code && (
                <span className="text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                  Code: {customer.code}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="px-5 py-3 border-b border-slate-200 grid grid-cols-2 gap-2 bg-white">
          <button
            onClick={handleCall}
            disabled={!customer.phone}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-teal-600" />
            <span>Call Patient</span>
          </button>
          <button
            onClick={handleWhatsApp}
            disabled={!customer.phone}
            className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors shadow-xs"
          >
            <MessageSquare className="w-3.5 h-3.5 text-white" />
            <span>WhatsApp Reminder</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Due Status Card */}
          <div className="bg-teal-50/70 border border-teal-200/80 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-teal-800 uppercase tracking-wider">
                  Next Refill Due Date
                </span>
                <p className="text-lg font-bold text-teal-950 font-mono mt-0.5">
                  {customer.nextDueDate || 'Not Calculated'}
                </p>
                <p className="text-xs text-teal-700 mt-1">
                  Alert Window: 5 days prior ({customer.alertDate})
                </p>
              </div>
              <button
                onClick={() => setIsCalendarOpen(true)}
                title="Select exact medication dispensed date in calendar"
                className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                <span>Mark Refilled</span>
              </button>
            </div>
          </div>

          {/* Regular Prescription Medicines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5 text-teal-600" />
                <span>Prescription Medicines ({customer.medicines.length})</span>
              </h3>
            </div>
            <div className="space-y-2">
              {customer.medicines.map((med, idx) => (
                <div
                  key={med.id || idx}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-teal-300 transition-colors shadow-2xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-800 leading-snug">
                        {med.name}
                      </p>
                      {med.packaging && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Pack: {med.packaging}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                      ₹{med.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                    <span>Qty: {med.unit || med.qty}</span>
                    <span>Cycle: {med.refillCycleDays} Days</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Patient Details & Statistics */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
              Account Overview
            </h4>
            <div className="flex justify-between text-slate-600">
              <span>First Purchase:</span>
              <span className="font-mono text-slate-800">{customer.firstPurchaseDate}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Latest Purchase:</span>
              <span className="font-mono text-slate-800">{customer.lastPurchaseDate}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Months Active:</span>
              <span className="font-semibold text-slate-800">{customer.monthsActive} Month(s)</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Total Recorded Spend:</span>
              <span className="font-bold text-emerald-700">₹{customer.totalSpend.toFixed(2)}</span>
            </div>
            {customer.address && (
              <div className="pt-2 border-t border-slate-200/80">
                <span className="text-slate-500 flex items-center gap-1 mb-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>Address:</span>
                </span>
                <p className="text-slate-700 text-xs">{customer.address}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Dispensed Date Calendar Modal */}
      <DispenseCalendarModal
        customer={customer}
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
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
