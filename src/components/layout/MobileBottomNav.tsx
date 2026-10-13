'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  CalendarClock, 
  Users, 
  FileSpreadsheet, 
  Menu,
  Lock
} from 'lucide-react';
import type { NavTab } from './Sidebar';

interface MobileBottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenMenu: () => void;
  monthlyDueCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenMenu,
  monthlyDueCount,
}) => {
  const items = [
    {
      id: 'dashboard' as NavTab,
      label: 'Home',
      icon: LayoutDashboard,
      badge: null,
      isPin: false,
    },
    {
      id: 'monthly' as NavTab,
      label: 'Monthly',
      icon: CalendarClock,
      badge: monthlyDueCount > 0 ? monthlyDueCount : null,
      isPin: false,
    },
    {
      id: 'customers' as NavTab,
      label: 'Patients',
      icon: Users,
      badge: null,
      isPin: true,
    },
    {
      id: 'uploads' as NavTab,
      label: 'Uploads',
      icon: FileSpreadsheet,
      badge: null,
      isPin: true,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200/90 px-1 py-1 shadow-lg pb-[max(0.375rem,env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-5 items-center justify-around max-w-lg mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`relative flex flex-col items-center justify-center min-h-[44px] py-1 px-1 rounded-xl transition-clinical touch-manipulation cursor-pointer active:scale-95 ${
                isActive 
                  ? 'text-teal-800 font-bold' 
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div className="relative">
                <div className={`p-1.5 rounded-xl transition-clinical ${isActive ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-500/20' : ''}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {item.isPin && (
                  <span className="absolute -top-1 -right-1 bg-slate-100 text-slate-500 rounded-full p-0.5 border border-slate-200">
                    <Lock className="w-2.5 h-2.5" />
                  </span>
                )}
                {item.badge !== null && (
                  <span className="absolute -top-1 -right-2 bg-amber-600 text-white text-[10px] font-bold tabular-nums rounded-full min-w-4 h-4 px-1 flex items-center justify-center shadow-xs">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold text-teal-800' : 'text-slate-600'}`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* More / Menu Drawer Button */}
        <button
          onClick={onOpenMenu}
          className="relative flex flex-col items-center justify-center min-h-[44px] py-1 px-1 rounded-xl text-slate-500 hover:text-slate-800 font-medium transition-clinical touch-manipulation cursor-pointer active:scale-95"
          aria-label="Open Navigation Menu"
        >
          <div className="p-1 rounded-lg">
            <Menu className="w-5 h-5 text-slate-600" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight text-slate-600 font-medium">
            More
          </span>
        </button>
      </div>
    </nav>
  );
};
