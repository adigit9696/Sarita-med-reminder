'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SplashScreen } from './SplashScreen';
import { Sidebar, type NavTab } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileBottomNav } from './MobileBottomNav';
import { PinLockModal } from '../lock/PinLockModal';
import { PinVerifyModal } from '../lock/PinVerifyModal';
import { CustomerDrawer } from '../customers/CustomerDrawer';
import { EditCustomerModal } from '../customers/EditCustomerModal';
import { DashboardView } from '../dashboard/DashboardView';
import { MonthlyCustomersView } from '../monthly/MonthlyCustomersView';
import { AllCustomersView } from '../customers/AllCustomersView';
import { BillsAndUploadsView } from '../uploads/BillsAndUploadsView';
import { AnalyticsView } from '../analytics/AnalyticsView';
import { PrintListView } from '../print/PrintListView';
import { SettingsView } from '../settings/SettingsView';
import { dataStore } from '@/lib/data-store';
import { audioAlerts } from '@/lib/audio-alerts';
import type { Customer, ReminderItem } from '@/types';

export const AppShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [startupPhase, setStartupPhase] = useState<'splash' | 'pin' | 'ready'>('splash');
  const [mounted, setMounted] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [batches, setBatches] = useState(dataStore.getBatches());
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [settings, setSettings] = useState(dataStore.getSettings());
  const [syncStatus, setSyncStatus] = useState(dataStore.getSyncStatus());
  const [isLocked, setIsLocked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Tab PIN Verification Modal State (Mandatory every time All Customers or Bills & Uploads is accessed)
  const [pinModalState, setPinModalState] = useState<{
    isOpen: boolean;
    targetTab: NavTab | null;
    title: string;
    subtitle: string;
  }>({
    isOpen: false,
    targetTab: null,
    title: '',
    subtitle: '',
  });

  // Sync state from dataStore
  const refreshState = useCallback(() => {
    setCustomers([...dataStore.getCustomers()]);
    setBatches([...dataStore.getBatches()]);
    setReminders([...dataStore.getReminders()]);
    setSettings({ ...dataStore.getSettings() });
    setSyncStatus(dataStore.getSyncStatus());
  }, []);

  useEffect(() => {
    setMounted(true);
    dataStore.init().then(refreshState);
    const unsubscribe = dataStore.subscribe(refreshState);
    return () => unsubscribe();
  }, [refreshState]);

  // Continuous 5-minute recurring sound alert for pending Alert Mode / Overdue customers
  useEffect(() => {
    if (!settings.enableAudioAlerts || startupPhase !== 'ready') {
      audioAlerts.stopRecurringAlert();
      return;
    }

    const pendingAlertsCount = reminders.filter(
      (r) => (r.urgency === 'DUE_IN_5_DAYS' || r.urgency === 'OVERDUE') && r.status === 'pending'
    ).length;

    if (pendingAlertsCount > 0) {
      audioAlerts.startRecurringAlert(() => {
        audioAlerts.sendBrowserNotification(
          'Sarita Pharmacy Medicine Reminder',
          `Continuous Alert: ${pendingAlertsCount} patient(s) in Alert Mode require refill confirmation.`
        );
      });
    } else {
      // Immediately stop recurring chime as soon as all tasks are marked complete/refilled
      audioAlerts.stopRecurringAlert();
    }

    return () => {
      audioAlerts.stopRecurringAlert();
    };
  }, [reminders, settings.enableAudioAlerts, startupPhase]);

  // Auto-lock inactivity timer
  useEffect(() => {
    if (isLocked || !settings.autoLockMinutes) return;

    let timeoutId: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsLocked(true);
      }, settings.autoLockMinutes * 60 * 1000);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('touchstart', resetTimer);

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [isLocked, settings.autoLockMinutes]);

  const handleMarkRefilled = (customerId: string) => {
    dataStore.markMedicineRefilled(customerId);
    if (selectedCustomer && selectedCustomer.id === customerId) {
      const updated = dataStore.getCustomers().find((c) => c.id === customerId);
      if (updated) setSelectedCustomer(updated);
    }
  };

  const handleRecordDispensedDate = (customerId: string, dispensedDate: string, cycleDays?: number) => {
    dataStore.recordDispensedDate(customerId, dispensedDate, cycleDays);
    if (selectedCustomer && selectedCustomer.id === customerId) {
      const updated = dataStore.getCustomers().find((c) => c.id === customerId);
      if (updated) setSelectedCustomer(updated);
    }
  };

  const handleToggleAudio = () => {
    const nextVal = !settings.enableAudioAlerts;
    dataStore.updateSettings({ enableAudioAlerts: nextVal });
    audioAlerts.setEnabled(nextVal);
    if (nextVal) audioAlerts.playSuccessChime();
  };

  const handleManualSync = () => {
    dataStore.syncWithFirebase();
  };

  const handleExportData = () => {
    const json = dataStore.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sarita_med_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dueIn5DaysCount = reminders.filter(
    (r) => r.urgency === 'DUE_IN_5_DAYS' && r.status === 'pending'
  ).length;

  const overdueCount = reminders.filter(
    (r) => r.urgency === 'OVERDUE' && r.status === 'pending'
  ).length;

  const handleTabChange = (tab: NavTab) => {
    setIsMobileMenuOpen(false);
    if (tab === 'customers') {
      setPinModalState({
        isOpen: true,
        targetTab: 'customers',
        title: 'Enter Staff PIN — All Customers Directory',
        subtitle: 'PIN entry is mandatory every time this directory is accessed.',
      });
      return;
    }
    if (tab === 'uploads') {
      setPinModalState({
        isOpen: true,
        targetTab: 'uploads',
        title: 'Enter Staff PIN — Bills & Uploads',
        subtitle: 'PIN entry is mandatory every time bill management is accessed.',
      });
      return;
    }
    if (tab === 'settings') {
      setPinModalState({
        isOpen: true,
        targetTab: 'settings',
        title: 'Enter Staff PIN — Settings & Security',
        subtitle: 'PIN entry is mandatory to view or modify store settings.',
      });
      return;
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Startup Phase: Splash Screen smoothly cross-fades into PIN Lock Screen
  if (!mounted || startupPhase === 'splash' || startupPhase === 'pin') {
    return (
      <div className="relative min-h-screen bg-slate-950">
        <PinLockModal
          isLocked={true}
          correctPin={settings.pin}
          onUnlock={() => {
            setStartupPhase('ready');
            setActiveTab('dashboard');
            audioAlerts.playSuccessChime();
          }}
        />
        {startupPhase === 'splash' && (
          <SplashScreen onComplete={() => setStartupPhase('pin')} />
        )}
      </div>
    );
  }

  // Phase 3: Dashboard (Home Page) and App Shell
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 antialiased">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        monthlyDueCount={dueIn5DaysCount + overdueCount}
        totalCustomersCount={customers.length}
        isFirebaseConnected={syncStatus.status === 'synced'}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          searchQuery={searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q);
          }}
          dueIn5DaysCount={dueIn5DaysCount}
          overdueCount={overdueCount}
          audioEnabled={settings.enableAudioAlerts}
          onToggleAudio={handleToggleAudio}
          syncStatus={syncStatus.status}
          isSyncing={syncStatus.isSyncing}
          onManualSync={handleManualSync}
          onLockApp={() => setIsLocked(true)}
          onSelectDueFilter={() => {
            setActiveTab('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <main className="flex-1 p-3 sm:p-6 pb-24 md:pb-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              customers={customers}
              reminders={reminders}
              searchQuery={searchQuery}
              onClearSearch={() => setSearchQuery('')}
              onSelectCustomer={(c) => setSelectedCustomer(c)}
              onMarkRefilled={handleMarkRefilled}
              onRecordDispensedDate={handleRecordDispensedDate}
              onUpdateStatus={(id, s) => dataStore.updateReminderStatus(id, s)}
              whatsappTemplate={settings.whatsappTemplate}
            />
          )}

          {activeTab === 'monthly' && (
            <MonthlyCustomersView
              customers={customers}
              onSelectCustomer={(c) => setSelectedCustomer(c)}
              onMarkRefilled={handleMarkRefilled}
              onRecordDispensedDate={handleRecordDispensedDate}
              whatsappTemplate={settings.whatsappTemplate}
            />
          )}

          {activeTab === 'customers' && (
            <AllCustomersView
              customers={customers}
              onSelectCustomer={(c) => setSelectedCustomer(c)}
              onToggleMonthly={(id, isMonthly) => dataStore.toggleCustomerMonthly(id, isMonthly)}
              onDeselectAllMonthly={() => dataStore.deselectAllMonthly()}
              onEditCustomer={(cust) => setCustomerToEdit(cust)}
            />
          )}

          {activeTab === 'uploads' && (
            <BillsAndUploadsView
              existingCustomers={customers}
              batches={batches}
              onCommitBatch={(merged, batch) => dataStore.setCustomers(merged, batch)}
              onRollbackBatch={(id) => dataStore.rollbackBatch(id)}
              onDeleteBatch={(id) => dataStore.deleteUploadBatch(id)}
              staffPin={settings.pin}
              defaultRefillCycleDays={settings.defaultRefillCycleDays}
              alertDaysBefore={settings.alertDaysBefore}
              onToggleMonthly={(id, isMonthly) => dataStore.toggleCustomerMonthly(id, isMonthly)}
              onSelectCustomer={(c) => setSelectedCustomer(c)}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              customers={customers}
              batches={batches}
            />
          )}

          {activeTab === 'print' && (
            <PrintListView
              customers={customers}
              reminders={reminders}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={(s) => dataStore.updateSettings(s)}
              onExportData={handleExportData}
              onImportData={(json) => dataStore.importJson(json)}
              onClearAll={() => dataStore.clearAllData()}
              onTriggerSync={handleManualSync}
              syncStatus={syncStatus.status}
              isSyncing={syncStatus.isSyncing}
            />
          )}
        </main>
      </div>

      {/* Customer Profile Drawer */}
      <CustomerDrawer
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        onMarkRefilled={handleMarkRefilled}
        onRecordDispensedDate={handleRecordDispensedDate}
        whatsappTemplate={settings.whatsappTemplate}
      />

      {/* Edit Customer & Prescriptions Modal */}
      <EditCustomerModal
        customer={customerToEdit}
        isOpen={!!customerToEdit}
        onClose={() => setCustomerToEdit(null)}
        onSave={(id, updates) => {
          dataStore.updateCustomerDetails(id, updates);
          setCustomerToEdit(null);
        }}
      />

      {/* Tab Mandatory PIN Verification Modal */}
      <PinVerifyModal
        isOpen={pinModalState.isOpen}
        title={pinModalState.title}
        subtitle={pinModalState.subtitle}
        correctPin={settings.pin}
        onSuccess={() => {
          if (pinModalState.targetTab) {
            setActiveTab(pinModalState.targetTab);
          }
          setPinModalState({ isOpen: false, targetTab: null, title: '', subtitle: '' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onCancel={() => {
          setPinModalState({ isOpen: false, targetTab: null, title: '', subtitle: '' });
        }}
      />

      {/* Staff PIN Lock Screen */}
      <PinLockModal
        isLocked={isLocked}
        correctPin={settings.pin}
        onUnlock={() => setIsLocked(false)}
      />

      {/* Mobile Bottom Navigation Bar (1-Thumb Navigation) */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onOpenMenu={() => setIsMobileMenuOpen(true)}
        monthlyDueCount={dueIn5DaysCount + overdueCount}
      />
    </div>
  );
};
