/**
 * Universal Serverless Email Dispatcher
 * Sends structured, professional HTML email briefings without external npm dependencies
 * Supports Resend (default free tier), Brevo, and SendGrid via native fetch.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { DEFAULT_FIREBASE_CONFIG } from './firebase';
import { generateReminders } from './refill-calculator';
import type { Customer, AppSettings } from '@/types';

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface PatientAlertSummaryItem {
  name: string;
  phone?: string;
  medicines: string;
  dueDate: string;
  daysRemaining: number;
  urgency: 'OVERDUE' | 'DUE_IN_5_DAYS' | 'UPCOMING';
  isMonthly?: boolean;
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  apiKey?: string;
  from?: string;
}

export interface OwnerBriefingOptions {
  source: 'cron' | 'manual';
  manualRecipient?: string;
  manualApiKey?: string;
  manualSender?: string;
  manualPatients?: PatientAlertSummaryItem[];
  isTest?: boolean;
}

export interface OwnerBriefingResult {
  success: boolean;
  status: string;
  messageId?: string;
  count: number;
  recipient?: string;
  error?: string;
  message?: string;
}

/**
 * Returns today's date formatted as YYYY-MM-DD in Asia/Kolkata timezone.
 */
export function getTodayISTDateString(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Returns an ISO timestamp's date portion formatted as YYYY-MM-DD in Asia/Kolkata timezone.
 */
export function getISTDateString(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return '';
  }
}

/**
 * Returns a reference Date representing midday today in Asia/Kolkata timezone.
 */
export function getNowInIST(): Date {
  const todayStr = getTodayISTDateString();
  const [y, m, d] = todayStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/**
 * Formats an ISO string into a human-friendly IST date and time string.
 * e.g. "01 Oct 2026, 09:15 AM IST"
 */
export function formatISTDateTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d) + ' IST';
  } catch {
    return '';
  }
}

/**
 * Initializes Firestore on the server with active environment variables
 * and falls back safely to DEFAULT_FIREBASE_CONFIG.
 */
function getServerFirestore() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
  };

  if (!config.projectId) return null;
  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  return getFirestore(app);
}

/**
 * Generates an executive-grade HTML email briefing for the pharmacy owner
 */
export function generateDailyAlertEmailHtml(
  pharmacyName: string,
  alertDateStr: string,
  patients: PatientAlertSummaryItem[]
): string {
  const overdueCount = patients.filter(p => p.urgency === 'OVERDUE').length;
  const dueSoonCount = patients.filter(p => p.urgency === 'DUE_IN_5_DAYS').length;

  const rowsHtml = patients.map((p, idx) => {
    const badgeBg = p.urgency === 'OVERDUE' ? '#fee2e2' : '#fef3c7';
    const badgeText = p.urgency === 'OVERDUE' ? '#b91c1c' : '#b45309';
    const badgeLabel = p.urgency === 'OVERDUE' ? `Overdue (${Math.abs(p.daysRemaining)}d)` : `Due in ${p.daysRemaining}d`;

    return `
      <tr style="border-bottom: 1px solid #f1f5f9; background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 12px 14px; font-weight: 600; color: #0f172a; font-size: 13px;">
          ${p.name}
          ${p.isMonthly ? '<span style="display:inline-block; margin-left:6px; background:#ecfdf5; color:#047857; font-size:10px; font-weight:700; padding:2px 6px; border-radius:12px; border:1px solid #a7f3d0;">MONTHLY</span>' : ''}
        </td>
        <td style="padding: 12px 14px; font-family: monospace; color: #475569; font-size: 12px;">
          ${p.phone ? `<a href="tel:${p.phone}" style="color: #0d9488; text-decoration: none; font-weight: 600;">+91 ${p.phone}</a>` : '<span style="color:#94a3b8; font-style:italic;">No phone</span>'}
        </td>
        <td style="padding: 12px 14px; color: #334155; font-size: 12px; line-height: 1.4;">
          ${p.medicines || 'Chronic Prescription'}
        </td>
        <td style="padding: 12px 14px; text-align: center; font-size: 12px;">
          <span style="display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: ${badgeBg}; color: ${badgeText};">
            ${badgeLabel}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${pharmacyName} Daily Refill Briefing</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    
    <!-- Top Header Banner -->
    <div style="background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); padding: 28px 24px; color: #ffffff;">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">${pharmacyName}</h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #ccfbf1; font-weight: 500;">
            Daily Executive Refill & Alert Briefing · ${alertDateStr}
          </p>
        </div>
      </div>
    </div>

    <!-- Alert Statistics Bar -->
    <div style="padding: 16px 24px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; gap: 16px;">
      <div style="flex: 1; background: #ffffff; padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
        <span style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Total Action Today</span>
        <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 2px;">${patients.length}</div>
      </div>
      <div style="flex: 1; background: #ffffff; padding: 12px; border-radius: 12px; border: 1px solid #fee2e2; text-align: center;">
        <span style="font-size: 11px; color: #b91c1c; font-weight: 600; text-transform: uppercase;">Overdue</span>
        <div style="font-size: 20px; font-weight: 800; color: #b91c1c; margin-top: 2px;">${overdueCount}</div>
      </div>
      <div style="flex: 1; background: #ffffff; padding: 12px; border-radius: 12px; border: 1px solid #fef3c7; text-align: center;">
        <span style="font-size: 11px; color: #b45309; font-weight: 600; text-transform: uppercase;">Due in 5 Days</span>
        <div style="font-size: 20px; font-weight: 800; color: #b45309; margin-top: 2px;">${dueSoonCount}</div>
      </div>
    </div>

    <!-- Patients Table -->
    <div style="padding: 20px 24px;">
      <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #0f172a;">
        Patients Requiring Medicine Refill:
      </h3>
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
        <thead>
          <tr style="background-color: #f1f5f9; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">
            <th style="padding: 10px 14px; border-radius: 6px 0 0 6px;">Patient</th>
            <th style="padding: 10px 14px;">Contact</th>
            <th style="padding: 10px 14px;">Prescribed Medicines</th>
            <th style="padding: 10px 14px; text-align: center; border-radius: 0 6px 6px 0;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <!-- Footer Note -->
    <div style="padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.5; text-align: center;">
      <p style="margin: 0;">
        This automated notification was generated by <strong>${pharmacyName} Smart Refill System</strong>.
      </p>
      <p style="margin: 4px 0 0 0; color: #94a3b8;">
        Staff can dispatch one-click WhatsApp refill reminders directly from the shop dashboard.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Universal email sender: Attempts delivery via Resend HTTP API
 * Strictly returns failure if API key is missing or Resend reports an error.
 */
export async function sendEmailViaProvider(payload: SendEmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = (payload.apiKey || process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || '').trim();
  const fromAddress = (payload.from || process.env.EMAIL_FROM || 'Sarita Pharmacy Alerts <onboarding@resend.dev>').trim();

  if (!apiKey) {
    console.warn('[EmailService] Delivery aborted: No Email API Key configured.');
    return {
      success: false,
      error: 'No Email API Key configured. Please add RESEND_API_KEY in environment variables or Settings.',
    };
  }

  if (!payload.to || !payload.to.includes('@')) {
    return {
      success: false,
      error: 'Invalid recipient email address.',
    };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [payload.to.trim()],
        subject: payload.subject,
        html: payload.html,
        text: payload.text || 'Sarita Pharmacy Medicine Reminder Daily Briefing',
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data?.message || data?.error || `HTTP ${res.status}: ${res.statusText}`;
      console.error(`[EmailService] Resend API error (${res.status}):`, errMsg);
      return { success: false, error: errMsg };
    }

    if (!data.id) {
      return { success: false, error: 'Resend did not return a valid message id.' };
    }

    return { success: true, messageId: data.id };
  } catch (err: unknown) {
    const errorStr = err instanceof Error ? err.message : String(err);
    console.error('[EmailService] Network exception sending email:', errorStr);
    return { success: false, error: errorStr };
  }
}

/**
 * Single shared briefing dispatcher used by both scheduled cron and manual test routes.
 */
export async function buildAndSendOwnerBriefing(options: OwnerBriefingOptions): Promise<OwnerBriefingResult> {
  const isCron = options.source === 'cron';
  const db = getServerFirestore();

  // 1. Fetch settings from Firestore if available
  let settings: AppSettings | null = null;
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'settings', 'app_config'));
      if (snap.exists()) {
        settings = snap.data() as AppSettings;
      }
    } catch (e) {
      console.warn('[EmailService] Note: Could not read settings from Firestore:', e);
    }
  }

  // 2. Resolve configuration (Settings -> Env vars -> Options)
  const recipient = options.manualRecipient?.trim() || settings?.ownerAlertEmail?.trim() || process.env.OWNER_ALERT_EMAIL?.trim() || '';
  const apiKey = options.manualApiKey?.trim() || settings?.emailProviderApiKey?.trim() || process.env.RESEND_API_KEY?.trim() || process.env.EMAIL_API_KEY?.trim() || '';
  const sender = options.manualSender?.trim() || settings?.emailSenderAddress?.trim() || process.env.EMAIL_FROM?.trim() || 'Sarita Pharmacy Alerts <onboarding@resend.dev>';

  const recipientSource = options.manualRecipient ? 'manual_input' : (settings?.ownerAlertEmail ? 'firestore_settings' : (process.env.OWNER_ALERT_EMAIL ? 'env_var' : 'none'));
  const apiKeySource = options.manualApiKey ? 'manual_input' : (settings?.emailProviderApiKey ? 'firestore_settings' : (process.env.RESEND_API_KEY ? 'env_var (RESEND_API_KEY)' : (process.env.EMAIL_API_KEY ? 'env_var (EMAIL_API_KEY)' : 'none')));
  const senderSource = options.manualSender ? 'manual_input' : (settings?.emailSenderAddress ? 'firestore_settings' : (process.env.EMAIL_FROM ? 'env_var (EMAIL_FROM)' : 'default_fallback'));

  console.log(`[EmailService] Execution mode: ${options.source}. Config sources: recipient=${recipientSource}, apiKey=${apiKeySource}, sender=${senderSource}`);

  // 3. For Cron: validate enabled flag
  if (isCron) {
    const isEnabled = settings?.enableOwnerEmailAlerts === true;
    if (!isEnabled) {
      console.log('[EmailService] Cron skipped: enableOwnerEmailAlerts is OFF in Settings.');
      if (db) {
        await updateDoc(doc(db, 'settings', 'app_config'), {
          lastOwnerEmailAlertStatus: 'skipped: disabled',
        }).catch(() => {});
      }
      return {
        success: true,
        status: 'skipped: disabled',
        count: 0,
        message: 'Owner email alerts are disabled in Settings.',
      };
    }

    if (!recipient) {
      console.log('[EmailService] Cron failed: No recipient email configured.');
      if (db) {
        await updateDoc(doc(db, 'settings', 'app_config'), {
          lastOwnerEmailAlertStatus: 'failed: no recipient email configured',
        }).catch(() => {});
      }
      return {
        success: false,
        status: 'failed: no recipient email configured',
        count: 0,
        error: 'No recipient email configured in Settings or OWNER_ALERT_EMAIL.',
      };
    }

    // 4. For Cron: Duplicate protection (IST Date)
    const todayIST = getTodayISTDateString();
    if (settings?.lastOwnerEmailAlertSentAt && settings.lastOwnerEmailAlertStatus === 'sent') {
      const lastSentIST = getISTDateString(settings.lastOwnerEmailAlertSentAt);
      if (lastSentIST === todayIST) {
        console.log(`[EmailService] Cron skipped: Alert email already successfully sent today (${todayIST} IST).`);
        return {
          success: true,
          status: 'skipped: already sent today',
          count: 0,
          message: `Alert email already successfully sent today (${todayIST} IST).`,
        };
      }
    }
  }

  // 5. Gather Patients to Alert
  let alertPatients: PatientAlertSummaryItem[] = [];

  if (isCron || !options.manualPatients) {
    if (!db) {
      const errMsg = 'Firestore database could not be initialized.';
      if (db && isCron) {
        await updateDoc(doc(db, 'settings', 'app_config'), {
          lastOwnerEmailAlertStatus: 'failed: ' + errMsg,
        }).catch(() => {});
      }
      return { success: false, status: 'failed: db init', count: 0, error: errMsg };
    }

    // Read all_customers and monthly_customers from Firestore
    const customersMap = new Map<string, Customer>();
    try {
      let customersSnap = await getDocs(collection(db, 'all_customers'));
      if (customersSnap.empty) {
        customersSnap = await getDocs(collection(db, 'customers'));
      }
      customersSnap.forEach(snap => {
        const c = snap.data() as Customer;
        if (c && c.id) customersMap.set(c.id, c);
      });
    } catch (e) {
      console.warn('[EmailService] Warning reading all_customers collection:', e);
    }

    try {
      const monthlySnap = await getDocs(collection(db, 'monthly_customers'));
      monthlySnap.forEach(snap => {
        const m = snap.data() as Customer;
        if (m && m.id) {
          const existing = customersMap.get(m.id);
          customersMap.set(m.id, {
            ...(existing || m),
            ...m,
            isMonthlyRegular: true,
          });
        }
      });
    } catch (e) {
      console.warn('[EmailService] Warning reading monthly_customers collection:', e);
    }

    const customers = Array.from(customersMap.values());
    const alertDays = settings?.alertDaysBefore ?? 5;
    const nowIST = getNowInIST();

    // Strictly enforce rules via generateReminders
    const activeReminders = generateReminders(customers, alertDays, nowIST);

    // Filter for active pending reminders in Alert window (Overdue or Due in 5 Days)
    const alertReminders = activeReminders.filter(
      r => (r.urgency === 'DUE_IN_5_DAYS' || r.urgency === 'OVERDUE') && r.status === 'pending'
    );

    alertPatients = alertReminders.map(r => ({
      name: r.customerName + (r.customerCode ? ` (Code: ${r.customerCode})` : ''),
      phone: r.customerPhone,
      medicines: r.medicinesSummary || (r.medicinesList ? r.medicinesList.slice(0, 4).join(', ') : 'Chronic Prescription Refill'),
      dueDate: r.dueDate,
      daysRemaining: r.daysRemaining,
      urgency: r.urgency,
      isMonthly: true,
    }));

    console.log(`[EmailService] Evaluated ${customers.length} total customers -> ${alertPatients.length} active monthly patients due for refill.`);
  } else {
    alertPatients = options.manualPatients;
  }

  // 6. Check empty list behavior
  if (alertPatients.length === 0) {
    if (isCron) {
      console.log('[EmailService] Cron skipped: No monthly customers in Alert Mode today.');
      if (db) {
        await updateDoc(doc(db, 'settings', 'app_config'), {
          lastOwnerEmailAlertStatus: 'skipped: nobody due',
        }).catch(() => {});
      }
      return {
        success: true,
        status: 'skipped: nobody due',
        count: 0,
        message: 'No patients in Alert Mode today. No email needed.',
      };
    } else if (options.isTest) {
      // Test mode fallback preview patients
      alertPatients = [
        {
          name: 'Ramesh Kumar (Sample)',
          phone: '9839123456',
          medicines: 'Telmeron 40 Tab, Glycomet GP1',
          dueDate: getTodayISTDateString(),
          daysRemaining: 0,
          urgency: 'OVERDUE',
          isMonthly: true,
        },
        {
          name: 'Sunita Sharma (Sample)',
          phone: '9811223344',
          medicines: 'Cardivas 3.125, Shelcal 500',
          dueDate: getTodayISTDateString(),
          daysRemaining: 2,
          urgency: 'DUE_IN_5_DAYS',
          isMonthly: true,
        },
      ];
    }
  }

  // 7. Check API key before sending
  if (!apiKey) {
    const errorMsg = 'No Email API Key configured. Please add RESEND_API_KEY in environment variables or Settings.';
    console.error('[EmailService] Delivery aborted:', errorMsg);
    if (db && isCron) {
      await updateDoc(doc(db, 'settings', 'app_config'), {
        lastOwnerEmailAlertStatus: 'failed: no api key',
      }).catch(() => {});
    }
    return {
      success: false,
      status: 'failed: no api key',
      count: alertPatients.length,
      recipient,
      error: errorMsg,
    };
  }

  if (!recipient || !recipient.includes('@')) {
    const errorMsg = 'Valid recipient email address is required.';
    if (db && isCron) {
      await updateDoc(doc(db, 'settings', 'app_config'), {
        lastOwnerEmailAlertStatus: 'failed: invalid recipient email',
      }).catch(() => {});
    }
    return {
      success: false,
      status: 'failed: invalid recipient email',
      count: alertPatients.length,
      error: errorMsg,
    };
  }

  // 8. Generate HTML and dispatch email
  const pharmacyName = 'Sarita Pharmacy';
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const subject = options.isTest && options.manualPatients?.length === 0
    ? `[TEST] ${pharmacyName} — Daily Patient Refill Alert Preview (${todayFormatted})`
    : `🔔 ${pharmacyName} Daily Alert: ${alertPatients.length} Patients Due for Refill Today (${todayFormatted})`;

  const html = generateDailyAlertEmailHtml(pharmacyName, todayFormatted, alertPatients);

  console.log(`[EmailService] Dispatching email with ${alertPatients.length} patients...`);

  const sendResult = await sendEmailViaProvider({
    to: recipient,
    subject,
    html,
    apiKey,
    from: sender,
  });

  // 9. Update Firestore settings document
  if (db && isCron) {
    try {
      if (sendResult.success) {
        await updateDoc(doc(db, 'settings', 'app_config'), {
          lastOwnerEmailAlertSentAt: new Date().toISOString(),
          lastOwnerEmailAlertStatus: 'sent',
        });
        console.log(`[EmailService] Successfully recorded 'sent' status in settings/app_config.`);
      } else {
        const shortError = (sendResult.error || 'delivery error').slice(0, 80);
        await updateDoc(doc(db, 'settings', 'app_config'), {
          lastOwnerEmailAlertStatus: `failed: ${shortError}`,
        });
        console.warn(`[EmailService] Recorded failure status in settings/app_config: failed: ${shortError}`);
      }
    } catch (e) {
      console.warn('[EmailService] Could not update settings/app_config after email send:', e);
    }
  }

  return {
    success: sendResult.success,
    status: sendResult.success ? 'sent' : `failed: ${(sendResult.error || 'error').slice(0, 80)}`,
    messageId: sendResult.messageId,
    count: alertPatients.length,
    recipient,
    error: sendResult.error,
    message: sendResult.success ? `Email sent successfully to owner.` : sendResult.error,
  };
}
