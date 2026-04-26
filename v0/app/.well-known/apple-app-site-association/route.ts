import { NextResponse } from 'next/server'

const AASA = {
  applinks: {
    apps: [],
    details: [
      {
        appID: '8VC4R5M425.com.runsmart.coach',
        paths: ['/auth/callback', '/auth/callback/*', '/auth/update-password', '/'],
      },
    ],
  },
}

export async function GET() {
  return NextResponse.json(AASA, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
