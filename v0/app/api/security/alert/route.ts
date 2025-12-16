import { NextResponse } from 'next/server';
import { withApiSecurity, ApiRequest } from '@/lib/security.middleware';
import { logger } from '@/lib/logger';

async function securityAlertHandler(req: ApiRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }
  
  try {
    const alert = await req.json();
    logger.warn('Security alert received:', alert);
    
    // In production, send alert to security team
    if (process.env.NODE_ENV === 'production') {
      // Critical security alerts should trigger immediate response
      if (alert.event?.severity === 'critical') {
        // Example: await sendToSecurityTeam(alert);
        // Example: await triggerIncidentResponse(alert);
      }
      
      // Example: await logToSecurityDashboard(alert);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to process security alert:', error);
    return NextResponse.json({ error: 'Failed to process alert' }, { status: 500 });
  }
}

export const POST = withApiSecurity(securityAlertHandler);