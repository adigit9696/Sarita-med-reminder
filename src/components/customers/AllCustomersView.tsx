'use client';

import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Phone, 
  Calendar, 
  ChevronRight, 
  Filter, 
  Sparkles,
  Pill,
  ArrowUpDown,
  Edit3,
  CheckSquare,
  Square
} from 'lucide-react';
import type { Customer } from '@/types';

interface AllCustomersViewProps {
  customers: Customer[];
  onSelectCustomer: (cust: Customer) => void;
  onToggleMonthly: (customerId: string, isMonthly: boolean) => void;
  onDeselectAllMonthly?: () => void;
  onEditCustomer: (cust: Customer) => void;
}

export const AllCustomersView: React.FC<AllCustomersViewProps> = ({
  customers,
  onSelectCustomer,
  onToggleMonthly,
  onDeselectAllMonthly,
  onEditCustomer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'MONTHLY_ONLY' | 'OCCASIONAL_ONLY'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'spend' | 'date'>('date');

  const filtered = customers
    .filter((c) => {
      if (typeFilter === 'MONTHLY_ONLY' && !c.isMonthlyRegular) return false;
      if (typeFilter === 'OCCASIONAL_ONLY' && c.isMonthlyRegular) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        c.name.toLowerCase().includes(term) ||
        c.phone?.includes(term) ||
        c.code?.includes(term) ||
        c.medicines.some((m) => m.name.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'spend') return b.totalSpend - a.totalSpend;
      return b.lastPurchaseDate.localeCompare(a.lastPurchaseDate);
    });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              All Registered Customers Directory
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
              {customers.length} Total Patients
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Complete master customer database compiled across all Excel files. Every past customer is preserved here so incoming monthly files can be cross-matched to detect recurring prescriptions.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, phone, or medicine..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-2 rounded-xl text-xs focus:bg-white focus:border-teal-500 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as unknown as typeof typeFilter)}
              className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 focus:border-teal-500 truncate"
            >
              <option value="ALL">All ({customers.length})</option>
              <option value="MONTHLY_ONLY">Monthly ({customers.filter(c => c.isMonthlyRegular).length})</option>
              <option value="OCCASIONAL_ONLY">Unticked ({customers.filter(c => !c.isMonthlyRegular).length})</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as unknown as typeof sortBy)}
              className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 focus:border-teal-500 truncate"
            >
              <option value="date">Sort: Recent Date</option>
              <option value="spend">Sort: Total Spend</option>
              <option value="name">Sort: Name A-Z</option>
            </select>
          </div>
          {onDeselectAllMonthly && customers.filter(c => c.isMonthlyRegular).length > 0 && (
            <button
              type="button"
              onClick={() => {
                const count = customers.filter(c => c.isMonthlyRegular).length;
                if (window.confirm(`Remove all ${count} customers from Monthly tracking? All customers will remain safely saved in 'All Customers' master list and can be manually ticked anytime.`)) {
                  onDeselectAllMonthly();
                }
              }}
              className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors shadow-2xs text-center"
              title="Uncheck all customers from Monthly tracking so you can select from scratch"
            >
              Deselect All Monthly ({customers.filter(c => c.isMonthlyRegular).length})
            </button>
          )}
        </div>
      </div>

      {/* Master Customers Content */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">
              No Customers Found
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Upload your Marg ERP Excel files to import your pharmacy customers.
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
                    <th className="py-3.5 px-3 text-center" title="Tick to include in Monthly Customers & Print List">Track Monthly</th>
                    <th className="py-3.5 px-5">Patient Name</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Contact Phone</th>
                    <th className="py-3.5 px-4 text-right">Total Spend</th>
                    <th className="py-3.5 px-4 text-center">Medicines</th>
                    <th className="py-3.5 px-4 text-center">Active</th>
                    <th className="py-3.5 px-4 text-center">Latest Bill</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((cust, idx) => (
                    <tr
                      key={cust.id}
                      onClick={() => onSelectCustomer(cust)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-3 text-center text-slate-400 font-mono font-medium text-xs">
                        {idx + 1}
                      </td>
                      <td 
                        className="py-3.5 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onToggleMonthly(cust.id, !cust.isMonthlyRegular)}
                          title={cust.isMonthlyRegular ? 'Remove from Monthly Customers' : 'Add to Monthly Customers'}
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
                            cust.isMonthlyRegular 
                              ? 'bg-teal-600 text-white shadow-2xs hover:bg-teal-700' 
                              : 'bg-slate-100 text-slate-400 border border-slate-300 hover:border-teal-400 hover:text-teal-600'
                          }`}
                        >
                          {cust.isMonthlyRegular ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-5 font-bold text-slate-900">
                        <div>
                          <span>{cust.name}</span>
                          {cust.code && (
                            <span className="block text-[10px] text-slate-400 font-mono font-normal">
                              Code: {cust.code}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {cust.isMonthlyRegular ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                            Monthly Regular
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                            New / Unticked
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        {cust.phone || <span className="text-slate-400 italic">No Phone</span>}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 text-right">
                        ₹{cust.totalSpend.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-600">
                        {cust.medicines.length} med(s)
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-600 font-mono">
                        {cust.monthsActive}m
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-500">
                        {cust.lastPurchaseDate}
                      </td>
                      <td 
                        className="py-3.5 px-5 text-right space-x-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onEditCustomer(cust)}
                          title="Edit Customer & Medicines"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 transition-colors inline-flex items-center"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectCustomer(cust)}
                          title="View Full Profile"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors inline-flex items-center"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Responsive Cards View */}
            <div className="lg:hidden divide-y divide-slate-100">
              {filtered.map((cust, idx) => (
                <div
                  key={cust.id}
                  onClick={() => onSelectCustomer(cust)}
                  className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Big Touch-Friendly Track Monthly Checkbox */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleMonthly(cust.id, !cust.isMonthlyRegular);
                        }}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors ${
                          cust.isMonthlyRegular 
                            ? 'bg-teal-600 text-white shadow-2xs hover:bg-teal-700' 
                            : 'bg-slate-100 text-slate-400 border border-slate-300 hover:border-teal-400'
                        }`}
                        title={cust.isMonthlyRegular ? 'Tracked in Monthly' : 'Tap to add to Monthly tracking'}
                      >
                        {cust.isMonthlyRegular ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-400 font-medium">#{idx + 1}</span>
                          <span className="font-bold text-sm text-slate-900 leading-snug">{cust.name}</span>
                        </div>
                        {cust.code && (
                          <span className="text-[10px] text-slate-400 font-mono block">Code: {cust.code}</span>
                        )}
                      </div>
                    </div>

                    <div>
                      {cust.isMonthlyRegular ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                          Monthly
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                          Unticked
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Customer Meta Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Contact Phone</span>
                      <span className="font-mono text-slate-700 text-[11px] font-semibold">
                        {cust.phone || <span className="text-slate-400 italic font-normal">None</span>}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Total Spend</span>
                      <span className="font-bold text-slate-900 text-[11px]">₹{cust.totalSpend.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Medicines</span>
                      <span className="text-slate-700 text-[11px] font-medium">{cust.medicines.length} med(s)</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Latest Bill</span>
                      <span className="font-mono text-slate-600 text-[11px]">{cust.lastPurchaseDate}</span>
                    </div>
                  </div>

                  {/* Quick Action Footer */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      Active for {cust.monthsActive} month(s)
                    </span>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onEditCustomer(cust)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 text-xs font-medium inline-flex items-center gap-1 transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectCustomer(cust)}
                        className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors inline-flex items-center"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
