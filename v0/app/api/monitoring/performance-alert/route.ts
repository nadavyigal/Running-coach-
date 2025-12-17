import { NextResponse } from 'next/server';
import { withApiSecurity, ApiRequest } from '@/lib/security.middleware';
import { logger } from '@/lib/logger';

async function performanceAlertHandler(req: ApiRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }
  
  try {
    const alert = await req.json();
    logger.warn('Performance alert received:', alert);
    
    // In production, send alert to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Example: await sendToSlack(alert);
      // Example: await sendToPagerDuty(alert);
      // Example: await sendToEmail(alert);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to process performance alert:', error);
    return NextResponse.json({ error: 'Failed to process alert' }, { status: 500 });
  }
}

export const POST = withApiSecurity(performanceAlertHandler);