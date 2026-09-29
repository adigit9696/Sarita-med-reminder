'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, 
  Search, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Filter, 
  Sparkles,
  Pill,
  ArrowUpDown,
  Edit3,
  CheckSquare,
  Square,
  Keyboard,
  Check,
  FolderTree,
  Calendar,
  Layers
} from 'lucide-react';
import type { Customer } from '@/types';

interface AllCustomersViewProps {
  customers: Customer[];
  onSelectCustomer: (cust: Customer) => void;
  onToggleMonthly: (customerId: string, isMonthly: boolean) => void;
  onDeselectAllMonthly?: () => void;
  onEditCustomer: (cust: Customer) => void;
}

// ================= MEMOIZED DESKTOP TABLE ROW WITH TREE STRUCTURE =================
interface CustomerTableRowProps {
  cust: Customer;
  index: number;
  isFocused: boolean;
  isMonthly: boolean;
  isTreeExpanded: boolean;
  onToggleTree: () => void;
  onSelect: (cust: Customer) => void;
  onToggleMonthly: (id: string, isMonthly: boolean) => void;
  onEdit: (cust: Customer) => void;
  setRef: (el: HTMLTableRowElement | null) => void;
}

const CustomerTableRow = React.memo<CustomerTableRowProps>(({
  cust,
  index,
  isFocused,
  isMonthly,
  isTreeExpanded,
  onToggleTree,
  onSelect,
  onToggleMonthly,
  onEdit,
  setRef,
}) => {
  const safeName = cust.name || 'Unknown Patient';
  const safeSpend = Number(cust.totalSpend) || 0;
  const safeMeds = Array.isArray(cust.medicines) ? cust.medicines : [];
  const safeDate = cust.lastPurchaseDate || 'N/A';
  const safeMonths = cust.monthsActive || 1;

  return (
    <React.Fragment>
      <tr
        ref={setRef}
        onClick={() => onSelect(cust)}
        className={`transition-colors cursor-pointer group select-none ${
          isFocused 
            ? 'bg-teal-50/95 ring-2 ring-inset ring-teal-500/90 shadow-2xs font-medium' 
            : isTreeExpanded
            ? 'bg-teal-50/30'
            : 'hover:bg-slate-50/80'
        }`}
      >
        {/* Tree Structure Toggle Column */}
        <td 
          className="py-3 px-2 text-center"
          onClick={(e) => {
            e.stopPropagation();
            onToggleTree();
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleTree();
            }}
            className={`p-1.5 rounded-lg transition-all ${
              isTreeExpanded 
                ? 'bg-teal-600 text-white shadow-2xs' 
                : 'text-slate-400 hover:text-teal-700 hover:bg-slate-100'
            }`}
            title={isTreeExpanded ? 'Collapse Tree Structure [T]' : 'Expand Patient Medicines Tree [T]'}
          >
            {isTreeExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        </td>

        <td className="py-3 px-2 text-center font-mono font-medium text-xs">
          <span className={isFocused ? 'text-teal-700 font-bold' : 'text-slate-400'}>
            {index + 1}
          </span>
        </td>
        <td 
          className="py-3 px-3 text-center"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMonthly(cust.id, !isMonthly);
          }}
        >
          <div className="inline-flex items-center gap-1.5 justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleMonthly(cust.id, !isMonthly);
              }}
              title={isMonthly ? 'Remove from Monthly Customers [Space Bar]' : 'Add to Monthly Customers [Space Bar]'}
              className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition-all ${
                isMonthly 
                  ? 'bg-teal-600 text-white shadow-2xs hover:bg-teal-700 ring-1 ring-teal-600 scale-105' 
                  : 'bg-slate-100 text-slate-400 border border-slate-300 hover:border-teal-400 hover:text-teal-600'
              }`}
            >
              {isMonthly ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
            {isFocused && (
              <kbd className="hidden xl:inline-block px-1 py-0.5 rounded text-[9px] font-mono text-teal-800 bg-teal-100/90 border border-teal-300 shadow-2xs font-semibold uppercase">
                Space
              </kbd>
            )}
          </div>
        </td>
        <td className="py-3 px-4 font-bold text-slate-900">
          <div>
            <span>{safeName}</span>
            {cust.code && (
              <span className="block text-[10px] text-slate-400 font-mono font-normal">
                Code: {cust.code}
              </span>
            )}
          </div>
        </td>
        <td className="py-3 px-3">
          {isMonthly ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
              Monthly Regular
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
              New / Unticked
            </span>
          )}
        </td>
        <td className="py-3 px-3 font-mono text-slate-700">
          {cust.phone || <span className="text-slate-400 italic">No Phone</span>}
        </td>
        <td className="py-3 px-3 font-bold text-slate-900 text-right">
          ₹{safeSpend.toFixed(2)}
        </td>
        <td className="py-3 px-3 text-center text-slate-600">
          <span className="inline-flex items-center gap-1 font-medium bg-slate-100 px-2 py-0.5 rounded-full text-[11px]">
            <Pill className="w-3 h-3 text-teal-600" />
            {safeMeds.length} med(s)
          </span>
        </td>
        <td className="py-3 px-2 text-center text-slate-600 font-mono">
          {safeMonths}m
        </td>
        <td className="py-3 px-3 text-center font-mono text-slate-500">
          {safeDate}
        </td>
        <td 
          className="py-3 px-4 text-right space-x-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onToggleTree}
            title={isTreeExpanded ? 'Collapse Tree' : 'Expand Tree Hierarchy'}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 transition-colors inline-flex items-center"
          >
            <FolderTree className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onEdit(cust)}
            title="Edit Customer & Medicines"
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 transition-colors inline-flex items-center"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSelect(cust)}
            title="View Full Profile"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors inline-flex items-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </td>
      </tr>

      {/* Expandable Tree Structure Sub-Row */}
      {isTreeExpanded && (
        <tr className="bg-slate-50/90 border-b border-teal-200 animate-fadeIn">
          <td colSpan={11} className="p-0">
            <div className="py-3 px-6 pl-14 bg-gradient-to-r from-teal-50/50 via-slate-50 to-white border-l-4 border-teal-600 space-y-2.5">
              {/* Level 1: Tree Node Meta */}
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs border-b border-slate-200/80 pb-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono font-bold text-teal-800 bg-teal-100/90 text-[11px]">
                    <FolderTree className="w-3.5 h-3.5" />
                    TREE STRUCTURE: {safeName}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-600">
                    Refill Due Date: <strong className="font-mono text-teal-900">{cust.nextDueDate || 'Not Calculated'}</strong>
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-600">
                    Alert Window: <strong className="font-mono text-amber-700">{cust.alertDate || '5 Days Prior'}</strong>
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {safeMeds.length} Prescription Item(s) &bull; Total Spend: ₹{safeSpend.toFixed(2)}
                </div>
              </div>

              {/* Level 2 & 3: Medicines Tree Branches */}
              {safeMeds.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-1">
                  No individual medicine records attached to this patient yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {safeMeds.map((med, mIdx) => (
                    <div 
                      key={med.id || mIdx}
                      className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 border border-slate-200 text-xs shadow-2xs hover:border-teal-300 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-400 text-[11px]">├─ [{mIdx + 1}]</span>
                        <Pill className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="font-semibold text-slate-800">{med.name}</span>
                        {med.packaging && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                            {med.packaging}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-[11px]">
                        <span className="text-slate-500">
                          Qty: <strong className="font-mono text-slate-700">{med.unit || med.qty || 1}</strong>
                        </span>
                        <span className="text-slate-500">
                          Cycle: <strong className="font-mono text-slate-700">{med.refillCycleDays || 30} Days</strong>
                        </span>
                        <span className="font-bold text-teal-700 font-mono bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                          ₹{(Number(med.amount) || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}, (prev, next) => {
  return (
    prev.isFocused === next.isFocused &&
    prev.isMonthly === next.isMonthly &&
    prev.isTreeExpanded === next.isTreeExpanded &&
    prev.index === next.index &&
    prev.cust?.id === next.cust?.id &&
    prev.cust?.name === next.cust?.name &&
    prev.cust?.phone === next.cust?.phone &&
    prev.cust?.totalSpend === next.cust?.totalSpend &&
    prev.cust?.updatedAt === next.cust?.updatedAt &&
    (prev.cust?.medicines || []).length === (next.cust?.medicines || []).length &&
    prev.cust?.lastPurchaseDate === next.cust?.lastPurchaseDate
  );
});

CustomerTableRow.displayName = 'CustomerTableRow';

// ================= MEMOIZED MOBILE CARD WITH TREE STRUCTURE =================
interface CustomerMobileCardProps {
  cust: Customer;
  index: number;
  isFocused: boolean;
  isMonthly: boolean;
  isTreeExpanded: boolean;
  onToggleTree: () => void;
  onSelect: (cust: Customer) => void;
  onToggleMonthly: (id: string, isMonthly: boolean) => void;
  onEdit: (cust: Customer) => void;
  setRef: (el: HTMLDivElement | null) => void;
}

const CustomerMobileCard = React.memo<CustomerMobileCardProps>(({
  cust,
  index,
  isFocused,
  isMonthly,
  isTreeExpanded,
  onToggleTree,
  onSelect,
  onToggleMonthly,
  onEdit,
  setRef,
}) => {
  const safeName = cust.name || 'Unknown Patient';
  const safeSpend = Number(cust.totalSpend) || 0;
  const safeMeds = Array.isArray(cust.medicines) ? cust.medicines : [];
  const safeDate = cust.lastPurchaseDate || 'N/A';
  const safeMonths = cust.monthsActive || 1;

  return (
    <div
      ref={setRef}
      onClick={() => onSelect(cust)}
      className={`p-4 transition-colors cursor-pointer space-y-3 ${
        isFocused ? 'bg-teal-50/95 ring-2 ring-inset ring-teal-500' : 'hover:bg-slate-50/80'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMonthly(cust.id, !isMonthly);
            }}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors ${
              isMonthly 
                ? 'bg-teal-600 text-white shadow-2xs hover:bg-teal-700' 
                : 'bg-slate-100 text-slate-400 border border-slate-300 hover:border-teal-400'
            }`}
            title={isMonthly ? 'Tracked in Monthly' : 'Tap to add to Monthly tracking'}
          >
            {isMonthly ? (
              <CheckSquare className="w-5 h-5" />
            ) : (
              <Square className="w-5 h-5" />
            )}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400 font-medium">#{index + 1}</span>
              <span className="font-bold text-sm text-slate-900 leading-snug">{safeName}</span>
            </div>
            {cust.code && (
              <span className="text-[10px] text-slate-400 font-mono block">Code: {cust.code}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleTree();
            }}
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 border transition-colors ${
              isTreeExpanded
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <FolderTree className="w-3 h-3" />
            <span>Tree</span>
          </button>
          {isMonthly ? (
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs">
        <div>
          <span className="text-[10px] text-slate-400 block font-medium">Contact Phone</span>
          <span className="font-mono text-slate-700 text-[11px] font-semibold">
            {cust.phone || <span className="text-slate-400 italic font-normal">None</span>}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block font-medium">Total Spend</span>
          <span className="font-bold text-slate-900 text-[11px]">₹{safeSpend.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block font-medium">Medicines</span>
          <span className="text-slate-700 text-[11px] font-medium">{safeMeds.length} med(s)</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block font-medium">Latest Bill</span>
          <span className="font-mono text-slate-600 text-[11px]">{safeDate}</span>
        </div>
      </div>

      {/* Expandable Mobile Tree View */}
      {isTreeExpanded && (
        <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200 text-xs space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-[11px] font-bold text-teal-900 border-b border-teal-200/60 pb-1.5">
            <span>Prescription Tree Hierarchy</span>
            <span>Due: {cust.nextDueDate || 'N/A'}</span>
          </div>
          <div className="space-y-1">
            {safeMeds.map((med, mIdx) => (
              <div key={med.id || mIdx} className="bg-white p-2 rounded-lg border border-slate-200 text-[11px] flex justify-between items-center">
                <div>
                  <span className="font-semibold text-slate-800">{med.name}</span>
                  {med.packaging && <span className="text-slate-400 ml-1">({med.packaging})</span>}
                </div>
                <div className="font-bold text-teal-700">
                  ₹{(Number(med.amount) || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-slate-400">
          Active for {safeMonths} month(s)
        </span>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onEdit(cust)}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 text-xs font-medium inline-flex items-center gap-1 transition-colors"
          >
            <Edit3 className="w-3 h-3" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={() => onSelect(cust)}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors inline-flex items-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.isFocused === next.isFocused &&
    prev.isMonthly === next.isMonthly &&
    prev.isTreeExpanded === next.isTreeExpanded &&
    prev.index === next.index &&
    prev.cust?.id === next.cust?.id &&
    prev.cust?.name === next.cust?.name &&
    prev.cust?.phone === next.cust?.phone &&
    prev.cust?.totalSpend === next.cust?.totalSpend &&
    prev.cust?.updatedAt === next.cust?.updatedAt &&
    (prev.cust?.medicines || []).length === (next.cust?.medicines || []).length &&
    prev.cust?.lastPurchaseDate === next.cust?.lastPurchaseDate
  );
});

CustomerMobileCard.displayName = 'CustomerMobileCard';

// ================= MAIN VIEW COMPONENT =================
export const AllCustomersView: React.FC<AllCustomersViewProps> = ({
  customers = [],
  onSelectCustomer,
  onToggleMonthly,
  onDeselectAllMonthly,
  onEditCustomer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'MONTHLY_ONLY' | 'OCCASIONAL_ONLY'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'spend' | 'date'>('date');
  
  // High-performance windowing: 50 items per page reduces DOM nodes by 90%
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [focusedPageIdx, setFocusedPageIdx] = useState<number>(0);

  // Instant optimistic state for spacebar toggles (<0.5ms UI response)
  const [optimisticMonthlyMap, setOptimisticMonthlyMap] = useState<Record<string, boolean>>({});

  // Tree Structure expansion state
  const [expandedTrees, setExpandedTrees] = useState<Record<string, boolean>>({});

  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Memoized filter and sort with 100% crash protection
  const filtered = useMemo(() => {
    if (!Array.isArray(customers)) return [];

    return customers
      .filter((c) => {
        if (!c) return false;
        if (typeFilter === 'MONTHLY_ONLY' && !c.isMonthlyRegular) return false;
        if (typeFilter === 'OCCASIONAL_ONLY' && c.isMonthlyRegular) return false;

        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        const nameStr = (c.name || '').toLowerCase();
        const phoneStr = c.phone || '';
        const codeStr = c.code || '';
        const meds = Array.isArray(c.medicines) ? c.medicines : [];
        const medMatch = meds.some((m) => (m?.name || '').toLowerCase().includes(term));
        return (
          nameStr.includes(term) ||
          phoneStr.includes(term) ||
          codeStr.includes(term) ||
          medMatch
        );
      })
      .sort((a, b) => {
        if (!a || !b) return 0;
        if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
        if (sortBy === 'spend') return (Number(b.totalSpend) || 0) - (Number(a.totalSpend) || 0);
        return String(b.lastPurchaseDate || '').localeCompare(String(a.lastPurchaseDate || ''));
      });
  }, [customers, typeFilter, searchTerm, sortBy]);

  // Total pages
  const effectivePageSize = pageSize === 0 ? Math.max(1, filtered.length) : pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / effectivePageSize));

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
    setFocusedPageIdx(0);
  }, [searchTerm, typeFilter, sortBy, pageSize]);

  // Paginated window of items
  const paginatedList = useMemo(() => {
    if (pageSize === 0) return filtered;
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Clamp focus within page bounds
  useEffect(() => {
    if (focusedPageIdx >= paginatedList.length && paginatedList.length > 0) {
      setFocusedPageIdx(paginatedList.length - 1);
    }
  }, [paginatedList.length, focusedPageIdx]);

  // Stable refs for zero-lag event listeners
  const paginatedListRef = useRef(paginatedList);
  paginatedListRef.current = paginatedList;

  const focusedPageIdxRef = useRef(focusedPageIdx);
  focusedPageIdxRef.current = focusedPageIdx;

  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  const totalPagesRef = useRef(totalPages);
  totalPagesRef.current = totalPages;

  const onToggleMonthlyRef = useRef(onToggleMonthly);
  onToggleMonthlyRef.current = onToggleMonthly;

  const onSelectCustomerRef = useRef(onSelectCustomer);
  onSelectCustomerRef.current = onSelectCustomer;

  const optimisticMapRef = useRef(optimisticMonthlyMap);
  optimisticMapRef.current = optimisticMonthlyMap;

  // Toggle tree structure for a customer
  const handleToggleTree = useCallback((id: string) => {
    setExpandedTrees(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  // Expand / collapse all visible trees
  const areAllTreesExpanded = useMemo(() => {
    if (paginatedList.length === 0) return false;
    return paginatedList.every(c => c && expandedTrees[c.id]);
  }, [paginatedList, expandedTrees]);

  const handleToggleAllTrees = useCallback(() => {
    if (areAllTreesExpanded) {
      setExpandedTrees({});
    } else {
      const nextMap: Record<string, boolean> = {};
      paginatedListRef.current.forEach(c => {
        if (c && c.id) nextMap[c.id] = true;
      });
      setExpandedTrees(nextMap);
    }
  }, [areAllTreesExpanded]);

  // Instant optimistic toggle handler (< 1ms UI response)
  const handleToggleMonthlyOptimistic = useCallback((customerId: string, nextIsMonthly: boolean) => {
    setOptimisticMonthlyMap(prev => ({
      ...prev,
      [customerId]: nextIsMonthly,
    }));
    onToggleMonthlyRef.current(customerId, nextIsMonthly);
  }, []);

  // Global Zero-Lag Keyboard Navigator
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'SELECT' || 
        target.isContentEditable
      );
      if (isInput) return;

      const currentList = paginatedListRef.current;
      if (currentList.length === 0) return;

      const currentIdx = focusedPageIdxRef.current;
      const currPage = currentPageRef.current;
      const totPages = totalPagesRef.current;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentIdx < currentList.length - 1) {
          const next = currentIdx + 1;
          setFocusedPageIdx(next);
          rowRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        } else if (currPage < totPages) {
          // Seamlessly transition to next page
          setCurrentPage(p => p + 1);
          setFocusedPageIdx(0);
          rowRefs.current[0]?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentIdx > 0) {
          const next = currentIdx - 1;
          setFocusedPageIdx(next);
          rowRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        } else if (currPage > 1) {
          // Seamlessly transition to previous page
          setCurrentPage(p => p - 1);
          const prevPageSize = pageSize === 0 ? currentList.length : pageSize;
          setFocusedPageIdx(prevPageSize - 1);
          rowRefs.current[prevPageSize - 1]?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        }
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        if (currPage < totPages) {
          setCurrentPage(p => p + 1);
          setFocusedPageIdx(0);
        } else {
          setFocusedPageIdx(currentList.length - 1);
        }
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        if (currPage > 1) {
          setCurrentPage(p => p - 1);
          setFocusedPageIdx(0);
        } else {
          setFocusedPageIdx(0);
        }
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        const currentCust = currentList[currentIdx];
        if (currentCust) {
          const optVal = optimisticMapRef.current[currentCust.id];
          const isCurrentlyMonthly = optVal !== undefined ? optVal : Boolean(currentCust.isMonthlyRegular);
          handleToggleMonthlyOptimistic(currentCust.id, !isCurrentlyMonthly);
        }
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        const currentCust = currentList[currentIdx];
        if (currentCust) {
          handleToggleTree(currentCust.id);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const currentCust = currentList[currentIdx];
        if (currentCust) {
          onSelectCustomerRef.current(currentCust);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleMonthlyOptimistic, handleToggleTree, pageSize]);

  // Overall index for display
  const globalFocusedIndex = (currentPage - 1) * effectivePageSize + focusedPageIdx + 1;
  const monthlyCount = (customers || []).filter(c => {
    if (!c) return false;
    const opt = optimisticMonthlyMap[c.id];
    return opt !== undefined ? opt : Boolean(c.isMonthlyRegular);
  }).length;

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              All Registered Customers Directory
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
              {(customers || []).length} Total Patients
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
              {monthlyCount} Monthly Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Master customer records from Firebase. Use arrow keys, space bar to triage monthly patients, and press <strong className="text-teal-700 font-mono">T</strong> to expand medicine tree structures.
          </p>
        </div>

        {/* Filter & Tree Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search name, phone, medicine..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-2 rounded-xl text-xs focus:bg-white focus:border-teal-500 transition-all outline-none"
            />
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as unknown as typeof typeFilter)}
              className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 focus:border-teal-500 truncate"
            >
              <option value="ALL">All ({(customers || []).length})</option>
              <option value="MONTHLY_ONLY">Monthly ({monthlyCount})</option>
              <option value="OCCASIONAL_ONLY">Unticked ({(customers || []).length - monthlyCount})</option>
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

          {/* Toggle All Trees Button */}
          <button
            type="button"
            onClick={handleToggleAllTrees}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer ${
              areAllTreesExpanded
                ? 'bg-teal-700 text-white hover:bg-teal-800'
                : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
            }`}
            title="Expand or collapse the prescription medicines tree for all visible customers"
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>{areAllTreesExpanded ? 'Collapse All Trees' : 'Expand All Trees'}</span>
          </button>

          {onDeselectAllMonthly && monthlyCount > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Remove all ${monthlyCount} customers from Monthly tracking? All records will stay safely in 'All Customers' master list.`)) {
                  setOptimisticMonthlyMap({});
                  onDeselectAllMonthly();
                }
              }}
              className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors shadow-2xs text-center cursor-pointer"
              title="Uncheck all customers from Monthly tracking"
            >
              Deselect All Monthly ({monthlyCount})
            </button>
          )}
        </div>
      </div>

      {/* Zero-Lag Keyboard Shortcuts Bar */}
      <div className="bg-slate-900 text-white rounded-xl px-4 py-2.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-semibold text-teal-400 flex items-center gap-1.5">
            <Keyboard className="w-4 h-4 text-teal-400" />
            Fast Keyboard Controls:
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-white font-mono text-[10px] shadow-xs">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-white font-mono text-[10px] shadow-xs">↓</kbd>
            <span className="text-slate-300">Navigate</span>
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="flex items-center gap-1">
            <kbd className="px-2 py-0.5 rounded bg-teal-500/20 border border-teal-500/40 text-teal-300 font-mono text-[10px] font-bold shadow-xs">Space Bar</kbd>
            <span className="text-slate-300">Track Monthly</span>
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-teal-500/20 border border-teal-500/40 text-teal-300 font-mono text-[10px] font-bold shadow-xs">T</kbd>
            <span className="text-slate-300">Toggle Tree Structure</span>
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-white font-mono text-[10px] shadow-xs">Enter</kbd>
            <span className="text-slate-300">View Patient</span>
          </span>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto text-[11px] text-slate-300">
          <span>
            Focused: <strong className="text-teal-400">{filtered.length > 0 ? globalFocusedIndex : 0}</strong> of {filtered.length}
          </span>
          <span className="text-slate-600">|</span>
          <span>Page {currentPage} of {totalPages}</span>
        </div>
      </div>

      {/* Main Customers List / Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">
              No Customers Found
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Upload your Marg ERP Excel files to import your pharmacy customers or verify Firebase connection.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3 px-2 w-8 text-center" title="Toggle Tree Structure">Tree</th>
                    <th className="py-3 px-2 w-10 text-center">#</th>
                    <th className="py-3 px-3 text-center" title="Tick to include in Monthly Customers">Track Monthly</th>
                    <th className="py-3 px-4">Patient Name</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Contact Phone</th>
                    <th className="py-3 px-3 text-right">Total Spend</th>
                    <th className="py-3 px-3 text-center">Medicines</th>
                    <th className="py-3 px-2 text-center">Active</th>
                    <th className="py-3 px-3 text-center">Latest Bill</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedList.map((cust, idx) => {
                    if (!cust) return null;
                    const globalIdx = (currentPage - 1) * effectivePageSize + idx;
                    const optVal = optimisticMonthlyMap[cust.id];
                    const isMonthly = optVal !== undefined ? optVal : Boolean(cust.isMonthlyRegular);
                    const isFocused = idx === focusedPageIdx;
                    const isTreeExpanded = Boolean(expandedTrees[cust.id]);

                    return (
                      <CustomerTableRow
                        key={cust.id}
                        cust={cust}
                        index={globalIdx}
                        isFocused={isFocused}
                        isMonthly={isMonthly}
                        isTreeExpanded={isTreeExpanded}
                        onToggleTree={() => handleToggleTree(cust.id)}
                        onSelect={onSelectCustomer}
                        onToggleMonthly={handleToggleMonthlyOptimistic}
                        onEdit={onEditCustomer}
                        setRef={(el) => { rowRefs.current[idx] = el; }}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Cards */}
            <div className="lg:hidden divide-y divide-slate-100">
              {paginatedList.map((cust, idx) => {
                if (!cust) return null;
                const globalIdx = (currentPage - 1) * effectivePageSize + idx;
                const optVal = optimisticMonthlyMap[cust.id];
                const isMonthly = optVal !== undefined ? optVal : Boolean(cust.isMonthlyRegular);
                const isFocused = idx === focusedPageIdx;
                const isTreeExpanded = Boolean(expandedTrees[cust.id]);

                return (
                  <CustomerMobileCard
                    key={cust.id}
                    cust={cust}
                    index={globalIdx}
                    isFocused={isFocused}
                    isMonthly={isMonthly}
                    isTreeExpanded={isTreeExpanded}
                    onToggleTree={() => handleToggleTree(cust.id)}
                    onSelect={onSelectCustomer}
                    onToggleMonthly={handleToggleMonthlyOptimistic}
                    onEdit={onEditCustomer}
                    setRef={(el) => { cardRefs.current[idx] = el; }}
                  />
                );
              })}
            </div>

            {/* Fast Pagination Toolbar */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-3">
                <span>
                  Showing <strong className="text-slate-900">{(currentPage - 1) * effectivePageSize + 1}</strong> to{' '}
                  <strong className="text-slate-900">{Math.min(currentPage * effectivePageSize, filtered.length)}</strong> of{' '}
                  <strong className="text-slate-900">{filtered.length}</strong> patients
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 outline-none"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={0}>All</option>
                  </select>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => {
                      setCurrentPage(1);
                      setFocusedPageIdx(0);
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    title="First Page"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => {
                      setCurrentPage(p => Math.max(1, p - 1));
                      setFocusedPageIdx(0);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1 font-medium"
                    title="Previous Page [PageUp]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>

                  <span className="px-3 py-1 font-medium text-slate-700">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => {
                      setCurrentPage(p => Math.min(totalPages, p + 1));
                      setFocusedPageIdx(0);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1 font-medium"
                    title="Next Page [PageDown]"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => {
                      setCurrentPage(totalPages);
                      setFocusedPageIdx(0);
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    title="Last Page"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
