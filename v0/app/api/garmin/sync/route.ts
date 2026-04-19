import { POST as postCanonicalGarminManualSync } from '@/app/api/devices/garmin/sync/manual/route'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  return postCanonicalGarminManualSync(req)
}

