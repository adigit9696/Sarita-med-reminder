'use client';

import React, { useState, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  UserPlus, 
  Phone, 
  MessageSquare, 
  Download, 
  Search, 
  CheckSquare, 
  Square,
  Calendar,
  Pill,
  Clock,
  Sparkles,
  RefreshCw,
  ArrowUpDown
} from 'lucide-react';
import type { Customer, UploadBatch, MissingCustomerAuditItem } from '@/types';
import { compareMonthlyBatches, exportMissingCustomersCSV } from '@/lib/monthly-comparator';
import { openWhatsAppChat } from '@/lib/whatsapp';

interface ErrorBoundaryProps {
  children: ReactNode;
  onClose?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class MonthlyAuditErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MonthlyAuditDrawer ErrorBoundary Caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col p-6 space-y-4 justify-center items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">Monthly Audit Sync Notification</h3>
            <p className="text-xs text-slate-500 max-w-md">
              A temporary calculation anomaly occurred while cross-referencing customer records. Click below to reload the comparison analysis cleanly.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => this.setState({ hasError: false })}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Audit Analysis</span>
              </button>
              {this.props.onClose && (
                <button
                  onClick={this.props.onClose}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface MonthlyAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  batches: UploadBatch[];
  allCustomers: Customer[];
  onToggleMonthly: (customerId: string, isMonthly: boolean) => void;
  onSelectCustomer?: (customer: Customer) => void;
}

type FilterCategory = 'MISSING' | 'RETAINED' | 'NEW' | 'MONTHLY_ROSTER' | 'ALL';
type SortOption = 'SPEND_DESC' | 'NAME_ASC' | 'MEDS_DESC';

const MonthlyAuditDrawerInner: React.FC<MonthlyAuditDrawerProps> = ({
  onClose,
  batches = [],
  allCustomers = [],
  onToggleMonthly,
  onSelectCustomer,
}) => {
  // Sort batches chronologically descending (August first, then July)
  const sortedBatches = useMemo(() => {
    try {
      if (!batches || !Array.isArray(batches)) return [];
      return [...batches].sort((a, b) => {
        const dateA = String(a.monthKey || a.periodEnd || a.uploadDate || '');
        const dateB = String(b.monthKey || b.periodEnd || b.uploadDate || '');
        return dateB.localeCompare(dateA);
      });
    } catch {
      return [];
    }
  }, [batches]);

  // Target batch = most recent (e.g. August); Reference batch = earlier month (e.g. July)
  const [targetBatchId, setTargetBatchId] = useState<string>(() => sortedBatches[0]?.id || '');
  const [refBatchId, setRefBatchId] = useState<string>(() => sortedBatches[1]?.id || sortedBatches[0]?.id || '');

  const [filterType, setFilterType] = useState<FilterCategory>('MISSING');
  const [sortBy, setSortBy] = useState<SortOption>('SPEND_DESC');
  const [searchQuery, setSearchQuery] = useState('');

  // Keep selection synced when batches change
  React.useEffect(() => {
    if (sortedBatches.length > 0) {
      if (!targetBatchId || !sortedBatches.some(b => b.id === targetBatchId)) {
        setTargetBatchId(sortedBatches[0].id);
      }
      if (!refBatchId || !sortedBatches.some(b => b.id === refBatchId)) {
        setRefBatchId(sortedBatches[1]?.id || sortedBatches[0].id);
      }
    }
  }, [sortedBatches, targetBatchId, refBatchId]);

  const targetBatch = useMemo(() => {
    return sortedBatches.find(b => b.id === targetBatchId);
  }, [sortedBatches, targetBatchId]);

  const refBatch = useMemo(() => {
    return sortedBatches.find(b => b.id === refBatchId);
  }, [sortedBatches, refBatchId]);

  const comparison = useMemo(() => {
    try {
      if (!refBatch || !targetBatch) return null;
      return compareMonthlyBatches(refBatch, targetBatch, allCustomers || []);
    } catch (err) {
      console.error('compareMonthlyBatches error:', err);
      return null;
    }
  }, [refBatch, targetBatch, allCustomers]);

  // Financial calculations with 100% precision
  const metrics = useMemo(() => {
    try {
      if (!comparison) return { missingSpend: 0, retainedSpend: 0, newSpend: 0, monthlyTrackedCount: 0 };
      const missingSpend = (comparison.missingCustomers || []).reduce((sum, item) => sum + (Number(item?.previousMonthSpend) || 0), 0);
      const retainedSpend = (comparison.retainedCustomers || []).reduce((sum, item) => sum + (Number(item?.previousMonthSpend) || 0), 0);
      const newSpend = (comparison.newCustomers || []).reduce((sum, item) => sum + (Number(item?.previousMonthSpend) || 0), 0);
      const monthlyTrackedCount = (allCustomers || []).filter(c => c?.isMonthlyRegular).length;

      return {
        missingSpend: Math.round(missingSpend * 100) / 100,
        retainedSpend: Math.round(retainedSpend * 100) / 100,
        newSpend: Math.round(newSpend * 100) / 100,
        monthlyTrackedCount,
      };
    } catch {
      return { missingSpend: 0, retainedSpend: 0, newSpend: 0, monthlyTrackedCount: 0 };
    }
  }, [comparison, allCustomers]);

  const handleWhatsAppOutreach = (item: MissingCustomerAuditItem) => {
    const phone = item.contactPhone || item.customer?.phone || item.customer?.phoneNorm;
    if (!phone) {
      alert('Patient does not have a registered contact phone number.');
      return;
    }
    const medNames = (item.previousMedicines || []).map(m => (typeof m === 'string' ? m : m?.name) || '').filter(Boolean).slice(0, 3).join(', ');
    const refMonth = comparison?.referenceBatch?.monthName || 'last month';
    const patientName = item.customer?.name || 'Customer';
    const msg = `Namaste ${patientName} ji,\n\nThis is Sarita Pharmacy. We noticed from your records with us in ${refMonth} that your regular medicines (${medNames || 'chronic medications'}) may be due for refill.\n\nYour patient discount remains active on all chronic refills. Would you like us to keep them packed or deliver them to your address?\n\nPlease let us know if you need any assistance.\n\nRegards,\nSarita Pharmacy`;
    
    openWhatsAppChat(phone, msg);
  };

  const handleCall = (item: MissingCustomerAuditItem) => {
    const phone = item.contactPhone || item.customer?.phone || item.customer?.phoneNorm;
    if (!phone) {
      alert('Patient does not have a registered contact phone number.');
      return;
    }
    window.location.href = `tel:${phone}`;
  };

  // Filter and sort items accurately
  const displayItems = useMemo(() => {
    try {
      if (!comparison) return [];
      let items: MissingCustomerAuditItem[] = [];

      if (filterType === 'MISSING') {
        items = comparison.missingCustomers || [];
      } else if (filterType === 'RETAINED') {
        items = comparison.retainedCustomers || [];
      } else if (filterType === 'NEW') {
        items = comparison.newCustomers || [];
      } else if (filterType === 'MONTHLY_ROSTER') {
        const allItems = [...(comparison.missingCustomers || []), ...(comparison.retainedCustomers || []), ...(comparison.newCustomers || [])];
        items = allItems.filter(i => i.customer?.isMonthlyRegular);
      } else {
        items = [...(comparison.missingCustomers || []), ...(comparison.retainedCustomers || []), ...(comparison.newCustomers || [])];
      }

      // Search query filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        items = items.filter(i => {
          const name = String(i.customer?.name || '').toLowerCase();
          const phone = String(i.contactPhone || '').toLowerCase();
          const code = String(i.customerCode || '').toLowerCase();
          const meds = (i.previousMedicines || []).some(m => {
            const mName = typeof m === 'string' ? m : (m?.name || '');
            return mName.toLowerCase().includes(q);
          });
          return name.includes(q) || phone.includes(q) || code.includes(q) || meds;
        });
      }

      // Sorting
      return [...items].sort((a, b) => {
        if (sortBy === 'SPEND_DESC') {
          return (Number(b.previousMonthSpend) || 0) - (Number(a.previousMonthSpend) || 0);
        }
        if (sortBy === 'MEDS_DESC') {
          return (b.previousMedicines?.length || 0) - (a.previousMedicines?.length || 0);
        }
        const nameA = String(a.customer?.name || '');
        const nameB = String(b.customer?.name || '');
        return nameA.localeCompare(nameB);
      });
    } catch {
      return [];
    }
  }, [comparison, filterType, searchQuery, sortBy]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end animate-fadeIn">
      <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-200/60 shadow-2xs">
              <FileSpreadsheet className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Monthly Audit & Customer Discount Tracker
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                  Cross-Reference
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Track discount customers across uploaded Marg bills and monitor chronic refill retention month-over-month.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {sortedBatches.length < 2 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center border border-amber-200">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">Two Monthly Sales Sheets Required for Audit</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                You currently have {sortedBatches.length} file registered. When at least two monthly sheets are uploaded (e.g. July vs. August), the system automatically compares all customers who received discounts and highlights anyone missing.
              </p>
            </div>
          ) : (
            <>
              {/* Month Selectors Row */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  <span>Select Monthly Bill Uploads to Cross-Reference</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Baseline / Previous Month */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Baseline Month (Previous Bill Sheet):
                    </label>
                    <select
                      value={refBatchId}
                      onChange={(e) => setRefBatchId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-teal-500 shadow-2xs"
                    >
                      {sortedBatches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.monthName ? `${b.monthName} — ` : ''}{b.fileName} ({b.totalCustomers || 0} discount pts)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Current / Target Month */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Current Month (Recent Bill Sheet):
                    </label>
                    <select
                      value={targetBatchId}
                      onChange={(e) => setTargetBatchId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-teal-500 shadow-2xs"
                    >
                      {sortedBatches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.monthName ? `${b.monthName} — ` : ''}{b.fileName} ({b.totalCustomers || 0} discount pts)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {refBatchId === targetBatchId && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    Please select two different monthly sheets to see the month-over-month audit comparison.
                  </p>
                )}
              </div>

              {/* Comparison Statistics Workshop Cards */}
              {comparison && refBatchId !== targetBatchId && (
                <div className="space-y-4">
                  {/* High Level Metrics Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Missing Card - HIGHLIGHTED IN DISTINCT COLOR */}
                    <div 
                      onClick={() => setFilterType('MISSING')}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        filterType === 'MISSING'
                          ? 'bg-rose-50 border-rose-400 shadow-md ring-2 ring-rose-300/50'
                          : 'bg-rose-50/60 border-rose-200 hover:border-rose-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Missing Patients</span>
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      </div>
                      <div className="text-xl font-black text-rose-900 mt-1">
                        {comparison.missingCount}
                      </div>
                      <p className="text-[10px] text-rose-600 mt-0.5 font-medium">
                        ₹{metrics.missingSpend.toLocaleString('en-IN')} previous spend
                      </p>
                    </div>

                    {/* Retained / Repeat Customers */}
                    <div 
                      onClick={() => setFilterType('RETAINED')}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        filterType === 'RETAINED'
                          ? 'bg-emerald-50 border-emerald-400 shadow-md ring-2 ring-emerald-300/50'
                          : 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Retained Regulars</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <div className="text-xl font-black text-emerald-900 mt-1">
                        {comparison.retainedCount}
                      </div>
                      <p className="text-[10px] text-emerald-600 mt-0.5 font-medium">
                        ₹{metrics.retainedSpend.toLocaleString('en-IN')} refilled
                      </p>
                    </div>

                    {/* New Customers */}
                    <div 
                      onClick={() => setFilterType('NEW')}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        filterType === 'NEW'
                          ? 'bg-sky-50 border-sky-400 shadow-md ring-2 ring-sky-300/50'
                          : 'bg-sky-50/50 border-sky-200 hover:border-sky-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">New This Month</span>
                        <UserPlus className="w-3.5 h-3.5 text-sky-600" />
                      </div>
                      <div className="text-xl font-black text-sky-900 mt-1">
                        {comparison.newCount}
                      </div>
                      <p className="text-[10px] text-sky-600 mt-0.5 font-medium">
                        ₹{metrics.newSpend.toLocaleString('en-IN')} spend
                      </p>
                    </div>

                    {/* Total in Monthly Roster */}
                    <div 
                      onClick={() => setFilterType('MONTHLY_ROSTER')}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        filterType === 'MONTHLY_ROSTER'
                          ? 'bg-teal-50 border-teal-400 shadow-md ring-2 ring-teal-300/50'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider">In Monthly Tab</span>
                        <Clock className="w-3.5 h-3.5 text-teal-600" />
                      </div>
                      <div className="text-xl font-black text-teal-900 mt-1">
                        {metrics.monthlyTrackedCount}
                      </div>
                      <p className="text-[10px] text-teal-600 mt-0.5 font-medium">
                        Tracked daily by staff
                      </p>
                    </div>
                  </div>

                  {/* Filter & Action Toolbar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search patient name, phone, Marg code, or medicine..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-2 rounded-xl text-xs focus:bg-white focus:border-teal-500 transition-all"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Sort Selector */}
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700">
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as SortOption)}
                          className="bg-transparent text-xs font-semibold focus:outline-hidden text-slate-700 cursor-pointer"
                        >
                          <option value="SPEND_DESC">Sort: Highest Spend</option>
                          <option value="MEDS_DESC">Sort: Most Medicines</option>
                          <option value="NAME_ASC">Sort: Name (A-Z)</option>
                        </select>
                      </div>

                      {/* Export CSV Button */}
                      <button
                        onClick={() => exportMissingCustomersCSV(comparison)}
                        disabled={comparison.missingCount === 0}
                        title="Download CSV calling sheet of missing discount customers"
                        className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-40 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export Missing CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Category Filter Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    <button
                      onClick={() => setFilterType('MISSING')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
                        filterType === 'MISSING'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                      }`}
                    >
                      Missing Patients ({comparison.missingCount})
                    </button>

                    <button
                      onClick={() => setFilterType('RETAINED')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
                        filterType === 'RETAINED'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      Retained Regulars ({comparison.retainedCount})
                    </button>

                    <button
                      onClick={() => setFilterType('NEW')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
                        filterType === 'NEW'
                          ? 'bg-sky-600 text-white shadow-2xs'
                          : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200'
                      }`}
                    >
                      New This Month ({comparison.newCount})
                    </button>

                    <button
                      onClick={() => setFilterType('MONTHLY_ROSTER')}
                      className={`px-3 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
                        filterType === 'MONTHLY_ROSTER'
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
                      }`}
                    >
                      In Monthly Tab
                    </button>

                    <button
                      onClick={() => setFilterType('ALL')}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all shrink-0 cursor-pointer ${
                        filterType === 'ALL'
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      All Records
                    </button>
                  </div>

                  {/* Customer Records Listing */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                      <span>
                        Showing {displayItems.length} records ({filterType})
                      </span>
                      {filterType === 'MISSING' && (
                        <span className="text-rose-700 font-bold flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                          Priority Outreach for Refill Confirmation
                        </span>
                      )}
                    </div>

                    {displayItems.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 text-slate-500 text-xs">
                        No customers matched this filter query.
                      </div>
                    ) : (
                      displayItems.map((item, idx) => {
                        const isMissing = item.status === 'MISSING_THIS_MONTH';
                        const isRetained = item.status === 'RETAINED';
                        const cust = item.customer;
                        if (!cust) return null;

                        const spendNum = Number(item.previousMonthSpend) || 0;
                        const formattedSpend = spendNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                        return (
                          <div
                            key={cust.id || `item_${idx}`}
                            className={`p-4 rounded-2xl border transition-all ${
                              isMissing
                                ? 'bg-rose-50/90 border-rose-300 shadow-xs hover:border-rose-400'
                                : isRetained
                                ? 'bg-white border-slate-200/80 hover:border-slate-300'
                                : 'bg-sky-50/40 border-sky-200/80 hover:border-sky-300'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              {/* Left Info Column */}
                              <div className="space-y-1.5 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span 
                                    onClick={() => onSelectCustomer && onSelectCustomer(cust)}
                                    className="font-bold text-slate-900 text-sm hover:text-teal-700 cursor-pointer"
                                  >
                                    {cust.name || 'Unnamed Patient'}
                                  </span>

                                  {/* DISTINCT BADGE COLOR FOR MISSING */}
                                  {isMissing ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-200 text-rose-900 border border-rose-300 inline-flex items-center gap-1">
                                      <AlertTriangle className="w-2.5 h-2.5 text-rose-700" />
                                      Missing This Month
                                    </span>
                                  ) : isRetained ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                      Retained Regular
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800 border border-sky-200 inline-flex items-center gap-1">
                                      <UserPlus className="w-2.5 h-2.5 text-sky-600" />
                                      New Discount Customer
                                    </span>
                                  )}

                                  {cust.isMonthlyRegular && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                                      In Monthly Tab
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                                  {item.customerCode && (
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold text-[11px] border border-slate-200">
                                      Marg Party Code: {item.customerCode}
                                    </span>
                                  )}
                                  {item.contactPhone ? (
                                    <span className="font-mono text-slate-700 font-semibold">
                                      Phone: {item.contactPhone}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">No phone attached</span>
                                  )}
                                  <span className="text-slate-700 font-bold">
                                    Spend: ₹{formattedSpend}
                                  </span>
                                </div>

                                {/* Previous Month Medicines */}
                                <div className="pt-1">
                                  <div className="text-[11px] text-slate-500 font-medium">
                                    {isMissing ? 'Prescriptions purchased in baseline month:' : 'Chronic Prescriptions:'}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {Array.isArray(item.previousMedicines) && item.previousMedicines.length > 0 ? (
                                      item.previousMedicines.slice(0, 5).map((med, mIdx) => {
                                        const medName = typeof med === 'string' ? med : (med?.name || 'Medicine');
                                        const medUnit = typeof med === 'object' && med ? (med.unit ? `(${med.unit})` : med.qty ? `(${med.qty})` : '') : '';
                                        return (
                                          <span 
                                            key={mIdx} 
                                            className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${
                                              isMissing 
                                                ? 'bg-rose-100/90 text-rose-900 border border-rose-200' 
                                                : 'bg-slate-100 text-slate-700'
                                            }`}
                                          >
                                            <Pill className="w-2.5 h-2.5 inline mr-1 opacity-70" />
                                            {medName} {medUnit}
                                          </span>
                                        );
                                      })
                                    ) : (
                                      <span className="text-[10px] text-slate-400 italic">No individual medicine details recorded</span>
                                    )}
                                    {Array.isArray(item.previousMedicines) && item.previousMedicines.length > 5 && (
                                      <span className="text-[10px] text-slate-500 self-center font-semibold">
                                        +{item.previousMedicines.length - 5} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right Action Column */}
                              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
                                {/* Toggle Monthly Roster Button */}
                                <button
                                  onClick={() => onToggleMonthly(cust.id, !cust.isMonthlyRegular)}
                                  title={cust.isMonthlyRegular ? 'Remove from Monthly Roster' : 'Add to Monthly Roster for daily countdown tracking'}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                    cust.isMonthlyRegular
                                      ? 'bg-teal-600 text-white shadow-2xs hover:bg-teal-700'
                                      : 'bg-white border border-slate-300 text-slate-700 hover:border-teal-500 hover:text-teal-700'
                                  }`}
                                >
                                  {cust.isMonthlyRegular ? (
                                    <>
                                      <CheckSquare className="w-3.5 h-3.5" />
                                      <span>In Monthly</span>
                                    </>
                                  ) : (
                                    <>
                                      <Square className="w-3.5 h-3.5" />
                                      <span>+ Add to Monthly</span>
                                    </>
                                  )}
                                </button>

                                {/* Direct Outreach Buttons */}
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleCall(item)}
                                    disabled={!item.contactPhone && !cust.phone && !cust.phoneNorm}
                                    title="Call Patient"
                                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-2xs cursor-pointer"
                                  >
                                    <Phone className="w-3.5 h-3.5 text-teal-600" />
                                  </button>
                                  <button
                                    onClick={() => handleWhatsAppOutreach(item)}
                                    disabled={!item.contactPhone && !cust.phone && !cust.phoneNorm}
                                    title="Send WhatsApp Follow-up regarding missing chronic refill"
                                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 transition-colors shadow-2xs cursor-pointer"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>All discount customer profiles are saved permanently in 'All Customers' master list.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export const MonthlyAuditDrawer: React.FC<MonthlyAuditDrawerProps> = (props) => {
  if (!props.isOpen) return null;

  return (
    <MonthlyAuditErrorBoundary onClose={props.onClose}>
      <MonthlyAuditDrawerInner {...props} />
    </MonthlyAuditErrorBoundary>
  );
};
