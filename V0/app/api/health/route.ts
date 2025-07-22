import { NextResponse } from 'next/server';
import { performHealthCheck, withErrorHandling } from '@/lib/errorHandling';

export const GET = withErrorHandling(async (req: Request) => {
  const healthResult = await performHealthCheck();
  
  const statusCode = healthResult.status === 'healthy' ? 200 : 
                    healthResult.status === 'degraded' ? 200 : 503;

  return NextResponse.json({
    success: healthResult.status !== 'unhealthy',
    ...healthResult
  }, { status: statusCode });
});