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
  Database,
  Mail,
  Send,
  HelpCircle,
  ExternalLink,
  Sparkles,
  Trash2,
  X,
  AlertTriangle
} from 'lucide-react';
import type { AppSettings } from '@/types';
import { audioAlerts } from '@/lib/audio-alerts';
import { DEFAULT_WHATSAPP_TEMPLATE } from '@/lib/whatsapp';
import { dataStore } from '@/lib/data-store';
import { getActiveFirebaseConfig, testFirebaseConnection } from '@/lib/firebase';
import { formatISTDateTime } from '@/lib/email-service';

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
  const [enableOwnerEmail, setEnableOwnerEmail] = useState(settings.enableOwnerEmailAlerts ?? false);
  const [ownerEmail, setOwnerEmail] = useState(settings.ownerAlertEmail || '');
  const [emailApiKey, setEmailApiKey] = useState(settings.emailProviderApiKey || '');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailFeedback, setTestEmailFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showEmailSetupGuide, setShowEmailSetupGuide] = useState(false);

  // Safe Full-Reset Tool State (Section 3.3)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState<'backup' | 'options' | 'confirm' | 'executing' | 'summary'>('backup');
  const [resetMode, setResetMode] = useState<'ALL' | 'KEEP_MONTHLY' | null>(null);
  const [resetPin, setResetPin] = useState('');
  const [resetConfirmWord, setResetConfirmWord] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSummary, setResetSummary] = useState<{
    deletedCustomers: number;
    deletedBatches: number;
    keptMonthly: number;
    newEpoch: string;
  } | null>(null);

  const handleStartSafeReset = () => {
    setIsResetModalOpen(true);
    setResetStep('backup');
    setResetMode(null);
    setResetPin('');
    setResetConfirmWord('');
    setResetError('');
    setResetSummary(null);
  };

  const handleExecuteReset = async () => {
    if (!resetMode) return;
    setResetError('');

    if (resetPin !== settings.pin) {
      setResetError('Incorrect Staff PIN. Please try again.');
      return;
    }

    if (resetConfirmWord.trim() !== 'DELETE') {
      setResetError('Please type "DELETE" in capital letters to confirm.');
      return;
    }

    setResetStep('executing');
    try {
      const res = await dataStore.executeSafeReset(resetMode);
      if (res.success) {
        setResetSummary({
          deletedCustomers: res.deletedCustomers,
          deletedBatches: res.deletedBatches,
          keptMonthly: res.keptMonthly,
          newEpoch: res.newEpoch,
        });
        setResetStep('summary');
        audioAlerts.playSuccessChime();
      } else {
        setResetError(res.error || 'Failed to execute cloud database reset.');
        setResetStep('confirm');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResetError(msg || 'An error occurred during reset.');
      setResetStep('confirm');
    }
  };

  const handleSaveParameters = () => {
    onUpdateSettings({
      alertDaysBefore: alertDays,
      defaultRefillCycleDays: cycleDays,
      whatsappTemplate: waTemplate,
      enableAudioAlerts: audioEnabled,
      enableOwnerEmailAlerts: enableOwnerEmail,
      ownerAlertEmail: ownerEmail.trim(),
      emailProviderApiKey: emailApiKey.trim(),
    });
    audioAlerts.setEnabled(audioEnabled);
    if (audioEnabled) {
      audioAlerts.playSuccessChime();
    }
    alert('Settings saved successfully!');
  };

  const handleSendTestEmail = async () => {
    if (!ownerEmail || !ownerEmail.includes('@')) {
      setTestEmailFeedback({ type: 'error', text: 'Please enter a valid owner email address first.' });
      return;
    }
    setIsSendingTestEmail(true);
    setTestEmailFeedback(null);
    try {
      // Gather all currently active patients in Alert Mode (Due in 5 Days or Overdue)
      const allReminders = dataStore.getReminders();
      const activeAlerts = allReminders.filter(
        (r) => (r.urgency === 'DUE_IN_5_DAYS' || r.urgency === 'OVERDUE') && r.status === 'pending'
      );

      // If there are alert patients, send all of them (e.g. all 16 patients in Alert Mode)
      const patientsToSend = (activeAlerts.length > 0 ? activeAlerts : allReminders.slice(0, 16)).map((r) => ({
        name: r.customerName + (r.customerCode ? ` (Code: ${r.customerCode})` : ''),
        phone: r.customerPhone,
        medicines: r.medicinesSummary || r.medicinesList.slice(0, 4).join(', '),
        dueDate: r.dueDate,
        daysRemaining: r.daysRemaining,
        urgency: r.urgency,
        isMonthly: true,
      }));

      const res = await fetch('/api/send-owner-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: ownerEmail.trim(),
          apiKey: emailApiKey.trim() || undefined,
          pharmacyName: 'Sarita Pharmacy',
          patients: patientsToSend,
          isTest: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestEmailFeedback({
          type: 'success',
          text: `Daily alert briefing for ${patientsToSend.length} active patient(s) successfully sent to ${ownerEmail.trim()}! Please check your inbox or spam folder.`
        });
        audioAlerts.playSuccessChime();
      } else {
        setTestEmailFeedback({
          type: 'error',
          text: data.error || 'Failed to send test email. Check your API key or network connection.'
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestEmailFeedback({ type: 'error', text: msg });
    } finally {
      setIsSendingTestEmail(false);
    }
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

      {/* Automated Owner Email Alerts (Serverless Cloud Cron) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-4 h-4 text-teal-600" />
              <span>Owner Automated Email Notifications (Serverless Cron)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Autonomous daily executive briefing delivered directly to the pharmacy owner at 9:00 AM IST. Runs 100% in the cloud without needing to keep the shop PC on or the app open.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowEmailSetupGuide(!showEmailSetupGuide)}
            className="text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
          >
            <HelpCircle className="w-3.5 h-3.5 text-teal-600" />
            <span>{showEmailSetupGuide ? 'Hide Guide' : 'Setup Guide'}</span>
          </button>
        </div>

        {/* Step-by-Step Guide Accordion */}
        {showEmailSetupGuide && (
          <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4 text-xs space-y-3 text-slate-700">
            <h4 className="font-bold text-teal-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>How to Setup Autonomous Owner Email Alerts in 3 Simple Steps:</span>
            </h4>
            <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
              <li>
                <strong>Enter your email address:</strong> Type the email address where you wish to receive daily morning refill alerts below.
              </li>
              <li>
                <strong>Get a free Resend API key (Takes 1 minute):</strong> Visit{' '}
                <a 
                  href="https://resend.com" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-teal-700 font-bold underline inline-flex items-center gap-0.5"
                >
                  resend.com <ExternalLink className="w-3 h-3" />
                </a>{' '}
                (free 3,000 emails/month). Create a free account, copy your API key (starts with <code className="bg-white px-1.5 py-0.5 rounded border border-teal-200 font-mono">re_...</code>), and paste it below.
              </li>
              <li>
                <strong>Autonomous Zero-Touch Delivery:</strong> Once deployed to Vercel, the built-in <code className="bg-white px-1.5 py-0.5 rounded border border-teal-200 font-mono">vercel.json</code> cron job fires every morning at <strong>09:00 AM IST</strong>, scans Firestore for patients due in 5 days or overdue, and sends you a clean executive summary table.
              </li>
            </ol>
            <p className="text-[11px] text-teal-800 italic pt-1 border-t border-teal-200/80">
              Tip: You can press <strong>"Send Test Alert Email"</strong> anytime to verify delivery straight to your inbox!
            </p>
          </div>
        )}

        {/* Enable Toggle & Email Input Form */}
        <div className="pt-2 border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEnableOwnerEmail(!enableOwnerEmail)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  enableOwnerEmail ? 'bg-teal-600' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                    enableOwnerEmail ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Enable Daily Owner Refill Alerts
                </p>
                <p className="text-[11px] text-slate-500">
                  Sends automated morning digest of patients in 5-day alert mode or overdue
                </p>
              </div>
            </div>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
              enableOwnerEmail ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {enableOwnerEmail ? 'ACTIVE' : 'OFF'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Owner Notification Email
              </label>
              <input
                type="email"
                placeholder="e.g. owner@pharmacy.com"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-800 focus:bg-white focus:border-teal-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                The email address that receives the daily refill summary.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Email Service API Key (Resend / Brevo)
              </label>
              <input
                type="password"
                placeholder="re_xxxxxxxxxxxxxx"
                value={emailApiKey}
                onChange={(e) => setEmailApiKey(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-800 font-mono text-xs focus:bg-white focus:border-teal-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Optional: If left blank, uses environment variable <code className="font-mono text-slate-700">RESEND_API_KEY</code>.
              </p>
            </div>
          </div>

          {/* Test Feedback Notice */}
          {testEmailFeedback && (
            <div className={`p-3 rounded-xl text-xs font-medium border flex items-center gap-2 ${
              testEmailFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {testEmailFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{testEmailFeedback.text}</span>
            </div>
          )}

          {/* Last Automatic Email Status & Helper Note */}
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Last automatic email:</span>
              <span className="font-mono text-slate-600">
                {settings.lastOwnerEmailAlertSentAt
                  ? `${formatISTDateTime(settings.lastOwnerEmailAlertSentAt)} — ${settings.lastOwnerEmailAlertStatus || 'sent'}`
                  : settings.lastOwnerEmailAlertStatus
                    ? `Never sent — ${settings.lastOwnerEmailAlertStatus}`
                    : 'Never run yet'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Runs automatically every morning around 9:00–9:59 AM IST on the live (Vercel) site.
            </p>
          </div>

          {/* Buttons: Save & Test Email */}
          <div className="flex items-center gap-3 pt-2 flex-wrap">
            <button
              type="button"
              onClick={handleSaveParameters}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Save Email Preferences
            </button>

            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={isSendingTestEmail || !ownerEmail}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {isSendingTestEmail ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
              ) : (
                <Send className="w-3.5 h-3.5 text-teal-600" />
              )}
              <span>{isSendingTestEmail ? 'Sending Test...' : 'Send Test Alert Email to Owner'}</span>
            </button>
          </div>
        </div>
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
            type="button"
            onClick={handleStartSafeReset}
            className="px-3 py-2 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-lg border border-rose-200 hover:border-rose-300 transition-colors ml-auto flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Safe Database Reset / Clear Data</span>
          </button>
        </div>
      </div>

      {/* Safe Full-Reset Tool Modal (Section 3.3) */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Safe Controlled Database Reset
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Controlled cloud & cache reset with stale-device epoch protection
                  </p>
                </div>
              </div>
              {resetStep !== 'executing' && (
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Step 1: Backup Requirement */}
            {resetStep === 'backup' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Step 1 of 3: Recommended Offline Backup</span>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Before performing any database reset, downloading an offline encrypted backup copy (.JSON) is strongly recommended so your records can be restored if needed.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      onExportData();
                      setResetStep('options');
                    }}
                    className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Backup (.JSON) & Proceed</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResetStep('options')}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors cursor-pointer"
                  >
                    Skip (I have a backup)
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Choose Reset Mode (No default selected) */}
            {resetStep === 'options' && (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-800">
                  Step 2 of 3: Choose Reset Scope (Explicit selection required):
                </p>

                <div className="space-y-3">
                  <label
                    onClick={() => setResetMode('ALL')}
                    className={`block p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      resetMode === 'ALL'
                        ? 'border-rose-500 bg-rose-50/50'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="reset_mode"
                        checked={resetMode === 'ALL'}
                        onChange={() => setResetMode('ALL')}
                        className="mt-0.5 text-rose-600 focus:ring-rose-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Option A — Clear Everything
                        </span>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Completely wipes all patient profiles (<code className="font-mono text-slate-800">all_customers</code>), monthly memberships (<code className="font-mono text-slate-800">monthly_customers</code>), and upload batch history (<code className="font-mono text-slate-800">all_uploads</code>). Leaves Staff PIN and email configurations untouched.
                        </p>
                      </div>
                    </div>
                  </label>

                  <label
                    onClick={() => setResetMode('KEEP_MONTHLY')}
                    className={`block p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      resetMode === 'KEEP_MONTHLY'
                        ? 'border-teal-500 bg-teal-50/50'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="reset_mode"
                        checked={resetMode === 'KEEP_MONTHLY'}
                        onChange={() => setResetMode('KEEP_MONTHLY')}
                        className="mt-0.5 text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Option B — Clear Everything Except My Monthly Customers
                        </span>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Deletes all upload batches and deletes only customers that are <strong className="text-slate-800">NOT</strong> marked as Monthly Regulars. Preserves all chosen Monthly Regular customers intact in both All Customers and Monthly Customers tabs. Leaves Staff PIN and email configurations untouched.
                        </p>
                      </div>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setResetStep('backup')}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    disabled={!resetMode}
                    onClick={() => {
                      setResetError('');
                      setResetStep('confirm');
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    Continue to Verification &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: PIN Verification & Typed "DELETE" */}
            {resetStep === 'confirm' && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-100 text-slate-700 text-xs">
                  <span className="font-semibold">Selected Scope: </span>
                  <span className="font-bold text-slate-900">
                    {resetMode === 'ALL' ? 'Option A — Clear Everything' : 'Option B — Clear Everything Except Monthly Regulars'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Enter Staff Security PIN
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={resetPin}
                      onChange={(e) => setResetPin(e.target.value)}
                      placeholder="••••"
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-800 font-mono tracking-widest text-center text-sm focus:bg-white focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Type <span className="font-mono text-rose-600 font-bold">DELETE</span> to confirm
                    </label>
                    <input
                      type="text"
                      value={resetConfirmWord}
                      onChange={(e) => setResetConfirmWord(e.target.value)}
                      placeholder="Type DELETE"
                      className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-slate-800 font-mono text-center text-sm focus:bg-white focus:border-rose-500"
                    />
                  </div>
                </div>

                {resetError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{resetError}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setResetStep('options')}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    disabled={!resetPin || resetConfirmWord.trim() !== 'DELETE'}
                    onClick={handleExecuteReset}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Confirm & Execute Database Reset</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Executing Progress */}
            {resetStep === 'executing' && (
              <div className="py-8 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-rose-600 animate-spin mx-auto" />
                <h4 className="text-sm font-bold text-slate-900">
                  Executing Safe Server-Side Reset...
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Deleting documents from Firestore in chunks of ≤ 400 and generating new synchronization epoch. Please do not close this window.
                </p>
              </div>
            )}

            {/* Step 5: Summary */}
            {resetStep === 'summary' && resetSummary && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-sm font-bold">Database Reset Completed Successfully!</span>
                  </div>
                  <div className="text-xs space-y-1 pt-1 font-medium text-emerald-800">
                    <p>&bull; Deleted Customers: <strong>{resetSummary.deletedCustomers}</strong></p>
                    <p>&bull; Deleted Upload Batches: <strong>{resetSummary.deletedBatches}</strong></p>
                    <p>&bull; Kept Monthly Regular Customers: <strong>{resetSummary.keptMonthly}</strong></p>
                    <p>&bull; New Synchronization Epoch: <code className="font-mono font-bold text-[11px] text-emerald-950">{resetSummary.newEpoch}</code></p>
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  A new epoch has been recorded in Firestore (<code className="font-mono text-slate-700">settings/data_state</code>). Any other shop PCs or mobile devices will automatically discard their stale local cache when next opened.
                </p>

                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  Close & View Clean Database
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
