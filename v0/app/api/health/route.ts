import { NextResponse } from 'next/server'
import { validateEnvironmentConfiguration } from '@/lib/apiKeyManager'

// Simple health check endpoint used by the NetworkStatusMonitor to
// avoid noisy connection-refused errors in the browser console.
// Last updated: 2026-01-01 16:47 - Redeploy after confirming sk-proj prefix on Vercel
export async function GET(request: Request) {
  // If diagnostic mode is requested via query param
  const url = new URL(request.url);
  if (url.searchParams.get('diagnostic') === 'true') {
    try {
      const envCheck = validateEnvironmentConfiguration();
      const hasOpenAI = !!process.env.OPENAI_API_KEY;

      return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        checks: {
          openai: {
            configured: hasOpenAI,
            // Removed API key prefix exposure for security
            valid: envCheck.isValid
          },
          issues: envCheck.issues
        }
      });
    } catch (error) {
      return NextResponse.json({
        status: 'error',
        error: 'Health check failed'
      }, { status: 500 });
    }
  }

  return new NextResponse(null, { status: 200 })
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}

