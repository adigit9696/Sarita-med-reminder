import { NextResponse } from 'next/server';
import { sendEmailViaProvider, generateDailyAlertEmailHtml, PatientAlertSummaryItem } from '@/lib/email-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      to, 
      apiKey, 
      patients = [], 
      pharmacyName = 'Sarita Pharmacy',
      isTest = false 
    } = body;

    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return NextResponse.json({ success: false, error: 'Valid email address is required.' }, { status: 400 });
    }

    const todayStr = new Date().toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    // If it's a test email with no patients, generate realistic sample preview patients
    const samplePatients: PatientAlertSummaryItem[] = patients.length > 0 ? patients : [
      {
        name: 'Ramesh Kumar (Sample)',
        phone: '9839123456',
        medicines: 'Telmeron 40 Tab, Glycomet GP1',
        dueDate: todayStr,
        daysRemaining: 0,
        urgency: 'OVERDUE',
        isMonthly: true
      },
      {
        name: 'Sunita Sharma (Sample)',
        phone: '9811223344',
        medicines: 'Cardivas 3.125, Shelcal 500',
        dueDate: todayStr,
        daysRemaining: 2,
        urgency: 'DUE_IN_5_DAYS',
        isMonthly: true
      },
      {
        name: 'Anil Gupta (Sample)',
        phone: '9935112233',
        medicines: 'Clonotril 0.5 mg, Revivo 300',
        dueDate: todayStr,
        daysRemaining: 4,
        urgency: 'DUE_IN_5_DAYS',
        isMonthly: true
      }
    ];

    const subject = isTest && patients.length === 0
      ? `[TEST] ${pharmacyName} — Daily Patient Refill Alert Preview`
      : `🔔 ${pharmacyName} Daily Alert: ${samplePatients.length} Patients Due for Refill Today`;

    const html = generateDailyAlertEmailHtml(pharmacyName, todayStr, samplePatients);

    const result = await sendEmailViaProvider({
      to,
      subject,
      html,
      apiKey: apiKey || undefined,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
