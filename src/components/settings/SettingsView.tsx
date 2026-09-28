'use client';

import React, { useState } from 'react';
import { 
  Settings, 
  Volume2, 
  Shield, 
  MessageSquare, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  KeyRound, 
  Clock,
  Cloud,
  CloudOff,
  RefreshCw,
  Database
} from 'lucide-react';
import type { AppSettings } from '@/types';
import { audioAlerts } from '@/lib/audio-alerts';
import { DEFAULT_WHATSAPP_TEMPLATE } from '@/lib/whatsapp';
import { dataStore } from '@/lib/data-store';
import { getActiveFirebaseConfig, testFirebaseConnection } from '@/lib/firebase';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onExportData: () => void;
  onImportData: (jsonStr: string) => boolean;
  onClearAll: () => void;
  onTriggerSync?: () => void;
  syncStatus?: 'disconnected' | 'synced' | 'syncing' | 'error';
  isSyncing?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onExportData,
  onImportData,
  onClearAll,
  onTriggerSync,
  syncStatus = 'disconnected',
  isSyncing = false,
}) => {
  const [alertDays, setAlertDays] = useState(settings.alertDaysBefore);
  const [cycleDays, setCycleDays] = useState(settings.defaultRefillCycleDays);
  const [waTemplate, setWaTemplate] = useState(settings.whatsappTemplate || DEFAULT_WHATSAPP_TEMPLATE);
  const [audioEnabled, setAudioEnabled] = useState(settings.enableAudioAlerts);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [isPushing, setIsPushing] = useState(false);

  const handleSaveParameters = () => {
    onUpdateSettings({
      alertDaysBefore: alertDays,
      defaultRefillCycleDays: cycleDays,
      whatsappTemplate: waTemplate,
      enableAudioAlerts: audioEnabled,
    });
    audioAlerts.setEnabled(audioEnabled);
    if (audioEnabled) {
      audioAlerts.playSuccessChime();
    }
    alert('Settings saved successfully!');
  };

  const handleResetWaTemplate = () => {
    setWaTemplate(DEFAULT_WHATSAPP_TEMPLATE);
  };

  const handlePinChange = () => {
    if (currentPin !== settings.pin) {
      setPinMessage('Current PIN is incorrect.');
      return;
    }
    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      setPinMessage('New PIN must be exactly 4 digits.');
      return;
    }
    onUpdateSettings({ pin: newPin });
    setCurrentPin('');
    setNewPin('');
    setPinMessage('Staff PIN successfully updated!');
    audioAlerts.playSuccessChime();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = onImportData(content);
        if (ok) {
          alert('Backup restored successfully!');
        } else {
          alert('Failed to parse backup JSON.');
        }
      }
    };
    reader.readAsText(file);
  };

  const handlePushAllToCloud = async () => {
    setIsPushing(true);
    setSyncMessage('');
    try {
      const res = await dataStore.forcePushToFirestore();
      if (res.success) {
        setSyncMessage(`All ${res.count} patient records and uploaded sales sheets are safely backed up in the cloud.`);
        audioAlerts.playSuccessChime();
      } else {
        setSyncMessage(`Backup note: ${res.error || 'Please check your internet connection'}`);
      }
    } catch (err: unknown) {
      setSyncMessage('Unable to complete backup. Please check your internet connection.');
    } finally {
      setIsPushing(false);
    }
  };

  const handleTestConnection = async () => {
    setSyncMessage('Verifying cloud backup connection...');
    const config = getActiveFirebaseConfig();
    if (!config) {
      setSyncMessage('Cloud backup settings not configured.');
      return;
    }
    const res = await testFirebaseConnection(config);
    if (res.success) {
      setSyncMessage('Cloud backup connection is active and healthy.');
      audioAlerts.playSuccessChime();
    } else {
      setSyncMessage('Cloud backup service is currently offline. Please check your internet connection.');
    }
  };

  const handleRestoreFromCloud = async () => {
    setIsPushing(true);
    setSyncMessage('Restoring All Customers data from cloud backup...');
    try {
      const res = await dataStore.forcePullFromFirestore();
      if (res.success) {
        setSyncMessage(`Successfully restored and synchronized ${res.count} customer records from cloud backup!`);
        audioAlerts.playSuccessChime();
      } else {
        setSyncMessage(`Restore note: ${res.error || 'Please check your internet connection'}`);
      }
    } catch (err: unknown) {
      setSyncMessage('Unable to complete restore. Please check your internet connection.');
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      {/* Cloud Backup & Store Synchronization Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Cloud className="w-4 h-4 text-teal-600" />
            <span>Cloud Backup & Store Synchronization</span>
          </h3>

          <div className="flex items-center gap-2">
            {syncStatus === 'synced' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Cloud Backup Active & Up to Date
              </span>
            ) : syncStatus === 'syncing' || isPushing ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Synchronizing Store Records...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <CloudOff className="w-3.5 h-3.5 text-slate-400" />
                Offline / Local Mode
              </span>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Automated cloud synchronization keeps your patients, prescriptions, and refill reminder schedules securely backed up. All customer data saved under the "All Customers" master directory remains permanently safe in the cloud and cannot be deleted when deleting monthly bill sheets.
        </p>

        {syncMessage && (
          <div className={`p-3 rounded-xl text-xs font-medium border flex items-center gap-2 animate-fadeIn ${
            syncMessage.includes('safely') || syncMessage.includes('healthy') || syncMessage.includes('active') || syncMessage.includes('Successfully')
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{syncMessage}</span>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap pt-2">
          <button
            onClick={handlePushAllToCloud}
            disabled={isPushing || isSyncing}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            {isPushing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4" />
            )}
            <span>Sync Store Data Now</span>
          </button>

          <button
            onClick={handleRestoreFromCloud}
            disabled={isPushing || isSyncing}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Restore all customer records from secure cloud storage into All Customers tab"
          >
            <Download className="w-4 h-4" />
            <span>Restore All Customers from Cloud</span>
          </button>

          <button
            onClick={handleTestConnection}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-slate-600" />
            <span>Check Backup Status</span>
          </button>

          {onTriggerSync && (
            <button
              onClick={onTriggerSync}
              disabled={isSyncing}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Refresh Cloud Records</span>
            </button>
          )}
        </div>
      </div>

      {/* Refill Parameters & Audio Alert Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-600" />
          <span>Refill Cycle & Alert Sound Preferences</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Advance Alert Window (Days Before Due Date)
            </label>
            <input
              type="number"
              min={1}
              max={15}
              value={alertDays}
              onChange={(e) => setAlertDays(parseInt(e.target.value) || 5)}
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-800 focus:bg-white focus:border-teal-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Default is 5 days. Triggers the audio chime and displays patient in Action Today.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Default Chronic Refill Cycle (Days)
            </label>
            <input
              type="number"
              min={7}
              max={90}
              value={cycleDays}
              onChange={(e) => setCycleDays(parseInt(e.target.value) || 30)}
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-800 focus:bg-white focus:border-teal-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Standard Indian pharmacy monthly refill cycle is 30 days.
            </p>
          </div>
        </div>

        {/* Audio Alerts Toggle & Test */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                audioEnabled ? 'bg-teal-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  audioEnabled ? 'left-6' : 'left-1'
                }`}
              />
            </button>
            <div>
              <p className="text-xs font-semibold text-slate-800">
                Audible Chimes & Voice Alerts
              </p>
              <p className="text-[11px] text-slate-500">
                Play pleasant chime when patients enter 5-day alert mode or overdue
              </p>
            </div>
          </div>

          <button
            onClick={() => audioAlerts.playFiveDayRefillAlert()}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Volume2 className="w-3.5 h-3.5 text-teal-600" />
            <span>Test Sound</span>
          </button>
        </div>
      </div>

      {/* WhatsApp Message Template Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-teal-600" />
            <span>WhatsApp Reminder Message Template (Hinglish)</span>
          </h3>
          <button
            onClick={handleResetWaTemplate}
            className="text-xs text-teal-600 hover:text-teal-700 hover:underline font-medium"
          >
            Reset to Standard Template
          </button>
        </div>

        <textarea
          rows={7}
          value={waTemplate}
          onChange={(e) => setWaTemplate(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:border-teal-500"
        />

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
          <p className="font-semibold text-slate-700">Available Dynamic Tags:</p>
          <p>
            <span className="font-mono text-teal-700 font-bold">{'{name}'}</span> - Patient Full Name
          </p>
          <p>
            <span className="font-mono text-teal-700 font-bold">{'{medicines}'}</span> - Bulleted list of chronic medicines with approx monthly consumption
          </p>
          <p>
            <span className="font-mono text-teal-700 font-bold">{'{date}'}</span> - Expected refill due date
          </p>
        </div>

        <button
          onClick={handleSaveParameters}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
        >
          Save Refill & Notification Settings
        </button>
      </div>

      {/* Staff PIN Security Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-4 h-4 text-teal-600" />
          <span>Staff Security & PIN Lock</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Current PIN
            </label>
            <input
              type="password"
              maxLength={4}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              placeholder="••••"
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-800 font-mono tracking-widest text-center text-sm focus:bg-white focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              New 4-Digit PIN
            </label>
            <input
              type="password"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="••••"
              className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-slate-800 font-mono tracking-widest text-center text-sm focus:bg-white focus:border-teal-500"
            />
          </div>
        </div>

        {pinMessage && (
          <p className="text-xs font-semibold text-teal-700">{pinMessage}</p>
        )}

        <button
          onClick={handlePinChange}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors"
        >
          Change Staff PIN
        </button>
      </div>

      {/* Backup & Restore Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Download className="w-4 h-4 text-slate-700" />
          <span>Database Backup & Restore</span>
        </h3>
        <p className="text-xs text-slate-500">
          Export your complete database (customers, batches, reminders, and settings) as an offline encrypted JSON file, or restore a previous backup.
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={onExportData}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Download Backup (.JSON)</span>
          </button>

          <label className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-4 h-4 text-slate-600" />
            <span>Restore Backup</span>
            <input type="file" accept=".json" onChange={handleFileInput} className="hidden" />
          </label>

          <button
            onClick={() => {
              if (confirm('CAUTION: This will wipe all local customers and batches. Proceed?')) {
                onClearAll();
                alert('Local database reset.');
              }
            }}
            className="px-3 py-2 text-rose-600 hover:bg-rose-50 text-xs font-medium rounded-lg transition-colors ml-auto"
          >
            Clear Local Data
          </button>
        </div>
      </div>
    </div>
  );
};
