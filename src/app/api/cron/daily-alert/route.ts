import { NextResponse } from 'next/server';
import { buildAndSendOwnerBriefing } from '@/lib/email-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  return handleCronExecution(request);
}

export async function POST(request: Request) {
  return handleCronExecution(request);
}

async function handleCronExecution(request: Request) {
  try {
    // 1. Strict Vercel Cron Secret validation
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn('[Cron] Unauthorized cron invocation attempt: Missing or invalid Bearer token.');
        return NextResponse.json({
          success: false,
          error: 'Unauthorized: Invalid or missing Bearer token.',
        }, { status: 401 });
      }
    } else {
      console.warn('[Cron] Notice: CRON_SECRET is not configured in environment variables. Executing in unprotected mode.');
    }

    // 2. Execute unified owner briefing
    const result = await buildAndSendOwnerBriefing({ source: 'cron' });

    const httpStatus = result.success ? 200 : (result.status === 'failed: db init' ? 500 : 200);
    return NextResponse.json(result, { status: httpStatus });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Cron] Unhandled exception in daily alert cron route:', errorMsg);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
