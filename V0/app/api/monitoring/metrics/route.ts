import { NextResponse } from 'next/server';
import { withApiSecurity, ApiRequest } from '@/lib/security.middleware';

async function metricsHandler(req: ApiRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }
  
  try {
    const metrics = await req.json();
    console.log('Performance metric received:', metrics);
    
    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Example: await sendToDataDog(metrics);
      // Example: await sendToNewRelic(metrics);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to process metrics:', error);
    return NextResponse.json({ error: 'Failed to process metrics' }, { status: 500 });
  }
}

export const POST = withApiSecurity(metricsHandler);