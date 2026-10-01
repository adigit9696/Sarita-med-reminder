import { NextResponse } from 'next/server';
import { buildAndSendOwnerBriefing } from '@/lib/email-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      to, 
      apiKey, 
      patients = [], 
      isTest = false 
    } = body;

    const result = await buildAndSendOwnerBriefing({
      source: 'manual',
      manualRecipient: to,
      manualApiKey: apiKey,
      manualPatients: patients,
      isTest,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
