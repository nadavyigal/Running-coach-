import { NextResponse } from 'next/server'

// Simple health check endpoint used by the NetworkStatusMonitor to
// avoid noisy connection-refused errors in the browser console.
export async function GET() {
  return new NextResponse(null, { status: 200 })
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}

