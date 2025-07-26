import { NextResponse } from 'next/server';
import { withApiSecurity, ApiRequest } from '@/lib/security.middleware';

async function cspViolationHandler(req: ApiRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }
  
  try {
    const violation = await req.json();
    console.warn('CSP violation received:', violation);
    
    // In production, send to security monitoring service
    if (process.env.NODE_ENV === 'production') {
      // CSP violations can indicate XSS attempts or misconfigurations
      // Example: await reportToSecurityService(violation);
      // Example: await updateCSPPolicy(violation);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to process CSP violation:', error);
    return NextResponse.json({ error: 'Failed to process violation' }, { status: 500 });
  }
}

export const POST = withApiSecurity(cspViolationHandler);