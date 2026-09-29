'use client';

import React from 'react';
import {
  Search,
  Bell,
  Volume2,
  VolumeX,
  Lock,
  Menu,
  RefreshCw
} from 'lucide-react';
import { audioAlerts } from '@/lib/audio-alerts';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  dueIn5DaysCount: number;
  overdueCount: number;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  syncStatus: 'disconnected' | 'synced' | 'syncing' | 'error';
  isSyncing: boolean;
  onManualSync: () => void;
  onLockApp: () => void;
  onSelectDueFilter: () => void;
  onOpenMobileMenu?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  searchQuery,
  onSearchChange,
  dueIn5DaysCount,
  overdueCount,
  audioEnabled,
  onToggleAudio,
  syncStatus,
  isSyncing,
  onManualSync,
  onLockApp,
  onSelectDueFilter,
  onOpenMobileMenu,
}) => {
  const totalAlerts = dueIn5DaysCount + overdueCount;

  const handleTestSound = () => {
    if (overdueCount > 0) {
      audioAlerts.playOverdueAlert();
    } else {
      audioAlerts.playFiveDayRefillAlert();
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs gap-2">
      {/* Mobile Hamburger + Global Search */}
      <div className="flex items-center gap-2 flex-1 min-w-0 max-w-lg">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 -ml-1 rounded-xl text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5 text-slate-700" />
          </button>
        )}

        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search patient, phone, medicine..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 pl-9 pr-7 py-1.5 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* 5-Day Alert Bell Banner */}
        {totalAlerts > 0 ? (
          <button
            onClick={() => {
              handleTestSound();
              onSelectDueFilter();
            }}
            title="Click to view urgent 5-day refill list & test alert chime"
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition-colors shadow-xs group"
          >
            <Bell className="w-4 h-4 text-amber-600 animate-bell-ring shrink-0" />
            <span className="hidden sm:inline">
              {totalAlerts} Due in 5 Days
            </span>
            <span className="sm:hidden font-bold">
              {totalAlerts}
            </span>
            <span className="hidden md:inline text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-mono group-hover:bg-amber-300">
              Chime
            </span>
          </button>
        ) : (
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>All Prescriptions Current</span>
          </div>
        )}

        {/* Audio Alerts Chime Toggle */}
        <button
          onClick={onToggleAudio}
          title={audioEnabled ? 'Audio Alerts Enabled (Click to Mute)' : 'Audio Alerts Muted (Click to Unmute)'}
          className={`p-2 rounded-xl border transition-all text-xs flex items-center gap-1.5 cursor-pointer ${audioEnabled
              ? 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100'
              : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
            }`}
        >
          {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          <span className="hidden xl:inline text-[11px] font-medium">
            {audioEnabled ? 'Sound On' : 'Muted'}
          </span>
        </button>

        {/* Real-time Cloud Sync Button (Next to Sound ON) */}
        <button
          onClick={onManualSync}
          disabled={isSyncing}
          title={
            isSyncing
              ? 'Synchronizing data with Cloud Firestore across all devices...'
              : syncStatus === 'synced'
                ? 'Cloud Database Synced (Click to Force Refresh from Cloud)'
                : syncStatus === 'error'
                  ? 'Sync Error (Click to Retry)'
                  : 'Click to Sync Data across All Devices'
          }
          className={`px-2.5 py-1.5 rounded-xl border transition-all text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs ${isSyncing
              ? 'bg-teal-50 border-teal-300 text-teal-700'
              : syncStatus === 'synced'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300'
                : syncStatus === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-teal-600' : syncStatus === 'synced' ? 'text-emerald-600' : 'text-slate-600'}`} />
          <span className="text-[11px] font-bold">
            {isSyncing ? 'Syncing...' : 'Sync'}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-slate-400'
            }`} />
        </button>


        {/* Lock Screen Button */}
        <button
          onClick={onLockApp}
          title="Lock Application"
          className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <Lock className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
