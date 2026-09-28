'use client';

import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Pill, 
  Award, 
  ArrowUpRight, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import type { Customer, UploadBatch } from '@/types';

interface AnalyticsViewProps {
  customers: Customer[];
  batches: UploadBatch[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  customers,
  batches,
}) => {
  const monthlyRegulars = customers.filter((c) => c.isMonthlyRegular);
  const totalRevenue = customers.reduce((acc, c) => acc + c.totalSpend, 0);
  const regularRevenue = monthlyRegulars.reduce((acc, c) => acc + c.totalSpend, 0);
  const retentionPercent = customers.length > 0 ? Math.round((monthlyRegulars.length / customers.length) * 100) : 0;

  // Top Customers by Spend
  const topCustomers = [...customers]
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 10);

  // Top Medicines by Frequency
  const medicineFrequency = new Map<string, { name: string; count: number; totalAmount: number }>();
  customers.forEach((c) => {
    c.medicines.forEach((m) => {
      const existing = medicineFrequency.get(m.nameNorm);
      if (existing) {
        existing.count += 1;
        existing.totalAmount += m.amount;
      } else {
        medicineFrequency.set(m.nameNorm, {
          name: m.name,
          count: 1,
          totalAmount: m.amount,
        });
      }
    });
  });

  const topMedicines = Array.from(medicineFrequency.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Pharmacy Sales
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            ₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            Across {batches.length} uploaded month(s)
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
            Monthly Regular Sales
          </span>
          <p className="text-2xl font-bold text-teal-700 mt-2 font-mono">
            ₹{regularRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[11px] text-teal-600 font-medium mt-1">
            {totalRevenue > 0 ? Math.round((regularRevenue / totalRevenue) * 100) : 0}% of pharmacy revenue
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Customer Retention
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {retentionPercent}%
          </p>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">
            Repeat monthly prescription rate
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Active Prescriptions
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {medicineFrequency.size}
          </p>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            Unique chronic medicines tracked
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers Ranking */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-amber-500" />
            <span>Top Regular Patients by Spend</span>
          </h3>

          <div className="space-y-2.5">
            {topCustomers.map((cust, idx) => (
              <div
                key={cust.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                      idx === 0
                        ? 'bg-amber-100 text-amber-800'
                        : idx === 1
                        ? 'bg-slate-200 text-slate-700'
                        : idx === 2
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    #{idx + 1}
                  </span>
                  <div>
                    <p className="font-bold text-slate-900">{cust.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {cust.phone || cust.code || 'Registered Patient'} · {cust.medicines.length} med(s)
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 font-mono">
                    ₹{cust.totalSpend.toFixed(2)}
                  </span>
                  <span className="block text-[10px] text-teal-600 font-semibold">
                    {cust.isMonthlyRegular ? 'Monthly Regular' : 'Occasional'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Prescribed Medicines */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Pill className="w-4 h-4 text-teal-600" />
            <span>Top Prescribed Chronic Medications</span>
          </h3>

          <div className="space-y-2.5">
            {topMedicines.map((med, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-teal-50 text-teal-700 font-bold text-[11px] flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-bold text-slate-900 leading-snug">{med.name}</p>
                    <p className="text-[11px] text-slate-500">
                      Active Patients: <span className="font-semibold text-slate-700">{med.count}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 font-mono">
                    ₹{med.totalAmount.toFixed(2)}
                  </span>
                  <span className="block text-[10px] text-slate-400">Total Billed</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
