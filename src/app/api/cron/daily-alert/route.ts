import { NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { sendEmailViaProvider, generateDailyAlertEmailHtml, PatientAlertSummaryItem } from '@/lib/email-service';
import type { Customer, AppSettings } from '@/types';

// Default fallback Firebase config from active credentials
const FALLBACK_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sarita-med-reminder',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

function getDbInstance(customConfig?: typeof FALLBACK_CONFIG) {
  const config = customConfig && customConfig.projectId ? customConfig : FALLBACK_CONFIG;
  if (!config.projectId) return null;
  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  return getFirestore(app);
}

export async function GET(request: Request) {
  return handleCronExecution(request);
}

export async function POST(request: Request) {
  return handleCronExecution(request);
}

async function handleCronExecution(request: Request) {
  try {
    // Optional Vercel Cron Secret validation
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[Cron] Note: Request executed without CRON_SECRET header.');
    }

    const db = getDbInstance();
    if (!db) {
      return NextResponse.json({
        success: false,
        error: 'Firestore database could not be initialized. Check Firebase environment variables.',
      }, { status: 500 });
    }

    // 1. Fetch settings from Firestore
    let settings: AppSettings | null = null;
    try {
      const settingsSnap = await getDoc(doc(db, 'settings', 'app_config'));
      if (settingsSnap.exists()) {
        settings = settingsSnap.data() as AppSettings;
      }
    } catch (e) {
      console.warn('[Cron] Could not read settings doc, using defaults', e);
    }

    const recipientEmail = settings?.ownerAlertEmail || process.env.OWNER_ALERT_EMAIL;
    const isEnabled = settings?.enableOwnerEmailAlerts !== false; // enabled by default if email exists

    if (!recipientEmail || !isEnabled) {
      return NextResponse.json({
        success: true,
        message: 'Cron executed, but owner email alerts are disabled or no email is configured in Settings.',
      });
    }

    // 2. Fetch all customers and monthly_customers from Firestore
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
      console.warn('[Cron] Could not read all_customers/customers collection:', e);
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
      console.warn('[Cron] Note reading monthly_customers collection:', e);
    }

    const customers = Array.from(customersMap.values());
    const todayISO = new Date().toISOString().split('T')[0];
    const alertDays = settings?.alertDaysBefore || 5;

    // 3. Filter for customers currently in Alert Mode (due in <= 5 days or overdue)
    const alertPatients: PatientAlertSummaryItem[] = [];

    customers.forEach(cust => {
      if (!cust) return;

      let effectiveDueDate = cust.nextDueDate;
      if (!effectiveDueDate && cust.lastPurchaseDate) {
        const lp = new Date(cust.lastPurchaseDate);
        lp.setDate(lp.getDate() + (settings?.defaultRefillCycleDays || 30));
        effectiveDueDate = lp.toISOString().split('T')[0];
      }

      if (!effectiveDueDate) return;

      const dueTime = new Date(effectiveDueDate).getTime();
      const todayTime = new Date(todayISO).getTime();
      const daysDiff = Math.round((dueTime - todayTime) / (1000 * 60 * 60 * 24));

      // In alert window: overdue or within alert days
      if (daysDiff <= alertDays && daysDiff >= -45) {
        const medsStr = (cust.medicines || [])
          .slice(0, 4)
          .map(m => m.name.replace(/\s+\d+\*\d+.*$/i, '').trim())
          .join(', ') + ((cust.medicines || []).length > 4 ? ` +${cust.medicines.length - 4} more` : '');

        alertPatients.push({
          name: cust.name + (cust.code ? ` (Code: ${cust.code})` : ''),
          phone: cust.phone,
          medicines: medsStr || 'Regular Prescription Refill',
          dueDate: effectiveDueDate,
          daysRemaining: daysDiff,
          urgency: daysDiff < 0 ? 'OVERDUE' : 'DUE_IN_5_DAYS',
          isMonthly: Boolean(cust.isMonthlyRegular),
        });
      }
    });

    // Prioritize monthly customers first, then overdue, then closest due date
    alertPatients.sort((a, b) => {
      if (a.isMonthly && !b.isMonthly) return -1;
      if (!a.isMonthly && b.isMonthly) return 1;
      return a.daysRemaining - b.daysRemaining;
    });

    if (alertPatients.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No patients in Alert Mode today. No email needed.',
        count: 0,
      });
    }

    // 4. Build and send HTML briefing email to pharmacy owner
    const todayFormatted = new Date().toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const html = generateDailyAlertEmailHtml('Sarita Pharmacy', todayFormatted, alertPatients);
    const subject = `🔔 Sarita Pharmacy Alert: ${alertPatients.length} Patients Due for Refill Today (${todayFormatted})`;

    const emailRes = await sendEmailViaProvider({
      to: recipientEmail,
      subject,
      html,
      apiKey: settings?.emailProviderApiKey,
      from: settings?.emailSenderAddress,
    });

    // 5. Update timestamp in Firestore
    try {
      await updateDoc(doc(db, 'settings', 'app_config'), {
        lastOwnerEmailAlertSentAt: new Date().toISOString(),
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json({
      success: emailRes.success,
      sentTo: recipientEmail,
      patientsAlertedCount: alertPatients.length,
      messageId: emailRes.messageId,
      error: emailRes.error,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Cron] Error executing daily alert cron:', err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
