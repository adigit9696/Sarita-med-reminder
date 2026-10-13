'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  CalendarClock, 
  Users, 
  FileSpreadsheet, 
  BarChart3, 
  Printer, 
  Settings, 
  Pill,
  Lock,
  X
} from 'lucide-react';
import { BRAND } from '@/lib/brand.config';

export type NavTab = 
  | 'dashboard'
  | 'monthly'
  | 'customers'
  | 'uploads'
  | 'analytics'
  | 'print'
  | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  monthlyDueCount: number;
  totalCustomersCount: number;
  isFirebaseConnected: boolean;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  monthlyDueCount,
  totalCustomersCount,
  isFirebaseConnected,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
      isPinProtected: false,
    },
    {
      id: 'monthly' as NavTab,
      label: 'Monthly Customers',
      icon: CalendarClock,
      badge: monthlyDueCount > 0 ? { count: monthlyDueCount, color: 'bg-amber-500 text-white' } : null,
      isPinProtected: false,
    },
    {
      id: 'customers' as NavTab,
      label: 'All Customers',
      icon: Users,
      badge: totalCustomersCount > 0 ? { count: totalCustomersCount, color: 'bg-slate-200 text-slate-700' } : null,
      isPinProtected: true,
    },
    {
      id: 'uploads' as NavTab,
      label: 'Bills & Uploads',
      icon: FileSpreadsheet,
      badge: null,
      isPinProtected: true,
    },
    {
      id: 'analytics' as NavTab,
      label: 'Analytics',
      icon: BarChart3,
      badge: null,
      isPinProtected: false,
    },
    {
      id: 'print' as NavTab,
      label: 'Print List',
      icon: Printer,
      badge: null,
      isPinProtected: false,
    },
    {
      id: 'settings' as NavTab,
      label: 'Settings',
      icon: Settings,
      badge: null,
      isPinProtected: true, // Settings is protected by PIN as requested
    },
  ];

  const handleItemClick = (id: NavTab) => {
    onTabChange(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const navContent = (
    <div className="flex flex-col justify-between h-full bg-[#0b1329]">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center shadow-xs text-white font-bold ring-1 ring-white/10 shrink-0">
              <Pill className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-white leading-tight">
                {BRAND.pharmacy.name}
              </h1>
              <p className="text-[11px] text-teal-400 font-semibold tracking-wider uppercase mt-0.5">
                {BRAND.shortName.replace('Sarita ', '')} Reminder
              </p>
            </div>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-clinical cursor-pointer"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Clean, Focused Navigation Menu */}
        <nav className="p-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-clinical touch-manipulation cursor-pointer ${
                  isActive
                    ? 'bg-teal-600 text-white font-semibold shadow-xs ring-1 ring-teal-500/30'
                    : 'text-slate-400 font-medium hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.isPinProtected && (
                    <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                  )}
                </div>
                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight tabular-nums shadow-2xs ${item.badge.color}`}
                  >
                    {item.badge.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer & Cloud Status */}
      <div className="p-4 border-t border-slate-800/70 text-[11px] text-slate-400 space-y-2.5">
        <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-slate-900/80 border border-slate-800/60">
          <span className="text-[10px] text-slate-400 font-medium">Cloud Database</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${isFirebaseConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-[10px] font-mono font-semibold text-slate-300">
              {isFirebaseConnected ? 'Connected' : 'Offline Cache'}
            </span>
          </div>
        </div>
        <p className="text-slate-500 text-[10px] text-center font-medium">
          {BRAND.tagline}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#0b1329] text-slate-100 flex-col shrink-0 h-screen sticky top-0 border-r border-slate-800/70 shadow-xl select-none transition-all duration-300 ease-in-out">
        {navContent}
      </aside>

      {/* Mobile Drawer Overlay with Smooth Transition Effects */}
      <div 
        className={`fixed inset-0 z-50 md:hidden bg-slate-950/75 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${
          isOpenMobile ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onCloseMobile}
        aria-hidden={!isOpenMobile}
      >
        <aside 
          className={`w-72 bg-[#0b1329] text-slate-100 h-full shadow-2xl flex flex-col select-none transition-transform duration-300 ease-in-out transform ${
            isOpenMobile ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {navContent}
        </aside>
      </div>
    </>
  );
};
