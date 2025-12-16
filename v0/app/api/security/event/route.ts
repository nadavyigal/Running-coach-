import { NextResponse } from 'next/server';
import { withApiSecurity, ApiRequest } from '@/lib/security.middleware';
import { logger } from '@/lib/logger';

async function securityEventHandler(req: ApiRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }
  
  try {
    const event = await req.json();
    logger.log('Security event received:', event);
    
    // In production, send to security monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Example: await sendToSIEM(event);
      // Example: await logToSecurityService(event);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to process security event:', error);
    return NextResponse.json({ error: 'Failed to process event' }, { status: 500 });
  }
}

export const POST = withApiSecurity(securityEventHandler);