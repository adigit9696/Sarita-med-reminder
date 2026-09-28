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
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20 text-white font-bold">
              <Pill className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-white leading-tight">
                Sarita Pharmacy
              </h1>
              <p className="text-[11px] text-teal-400 font-medium">
                Med Reminder
              </p>
            </div>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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
                className={`w-full flex items-center justify-between px-3.5 py-3 md:py-2.5 rounded-xl text-xs font-medium transition-all duration-150 touch-manipulation active:scale-[0.98] ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-900/30 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.isPinProtected && (
                    <Lock className="w-3 h-3 text-slate-400 opacity-70" />
                  )}
                </div>
                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${item.badge.color}`}
                  >
                    {item.badge.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer & Tagline */}
      <div className="p-4 border-t border-slate-800/80 text-[11px] text-slate-400 text-center">
        <p className="text-slate-500 text-[10px]">
          {BRAND.tagline}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar with smooth styling */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-100 flex-col shrink-0 h-screen sticky top-0 border-r border-slate-800 shadow-xl select-none transition-all duration-300 ease-in-out">
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
          className={`w-72 bg-slate-900 text-slate-100 h-full shadow-2xl flex flex-col select-none transition-transform duration-300 ease-in-out transform ${
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
