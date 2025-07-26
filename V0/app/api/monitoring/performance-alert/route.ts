import { NextResponse } from 'next/server';
import { withApiSecurity, ApiRequest } from '@/lib/security.middleware';

async function performanceAlertHandler(req: ApiRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }
  
  try {
    const alert = await req.json();
    console.warn('Performance alert received:', alert);
    
    // In production, send alert to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Example: await sendToSlack(alert);
      // Example: await sendToPagerDuty(alert);
      // Example: await sendToEmail(alert);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to process performance alert:', error);
    return NextResponse.json({ error: 'Failed to process alert' }, { status: 500 });
  }
}

export const POST = withApiSecurity(performanceAlertHandler);