import { NextResponse } from 'next/server';
import { chatDriver } from '@/lib/chatDriver';
import { logger } from '@/lib/logger';
import { securityConfig } from '@/lib/security.config';

export async function GET() {
  const startTime = Date.now();
  
  try {
    logger.log('[chat:ping] Checking chat service health...');
    
    const health = await chatDriver.health();
    const totalLatency = Date.now() - startTime;
    
    logger.log(`[chat:ping] Health check completed in ${totalLatency}ms, service available: ${health.available}`);
    
    if (!health.available) {
      return NextResponse.json({
        success: false,
        available: false,
        error: health.lastError || 'Service unavailable',
        latency: totalLatency,
        timestamp: new Date().toISOString(),
      }, { status: 503 });
    }
    
    return NextResponse.json({
      success: true,
      available: true,
      model: health.model,
      latency: totalLatency,
      serviceLatency: health.latency,
      quota: health.quota,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    const totalLatency = Date.now() - startTime;
    logger.error('[chat:ping] Health check failed:', error);
    
    return NextResponse.json({
      success: false,
      available: false,
      error: 'Health check failed',
      latency: totalLatency,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function OPTIONS(req: Request) {
  const allowedOrigins = securityConfig.apiSecurity.cors.origin
  const requestOrigin = req.headers.get('origin') || ''
  const isAllowed =
    allowedOrigins.includes(requestOrigin) ||
    (process.env.NODE_ENV === 'development' && requestOrigin.startsWith('http://localhost'))

  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': isAllowed ? requestOrigin : 'null',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
