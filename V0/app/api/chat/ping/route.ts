import { NextResponse } from 'next/server';
import { chatDriver } from '@/lib/chatDriver';

export async function GET() {
  const startTime = Date.now();
  
  try {
    console.log('[chat:ping] Checking chat service health...');
    
    const health = await chatDriver.health();
    const totalLatency = Date.now() - startTime;
    
    console.log(`[chat:ping] Health check completed in ${totalLatency}ms, service available: ${health.available}`);
    
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
    console.error('[chat:ping] Health check failed:', error);
    
    return NextResponse.json({
      success: false,
      available: false,
      error: 'Health check failed',
      latency: totalLatency,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Allow CORS for development testing
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}