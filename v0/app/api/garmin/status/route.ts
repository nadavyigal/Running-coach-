import { GET as getCanonicalGarminStatus } from '@/app/api/devices/garmin/status/route'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return getCanonicalGarminStatus(req)
}

