/**
 * Path-based secret webhook endpoint for Garmin.
 *
 * Garmin's developer portal strips query parameters from stored webhook URLs.
 * This route accepts the GARMIN_WEBHOOK_SECRET as a URL path segment so that
 * it survives portal round-trips.
 *
 * Configure the Garmin portal with:
 *   https://runsmart-ai.com/api/devices/garmin/webhook/<GARMIN_WEBHOOK_SECRET>
 *
 * Requests are validated by comparing the path token against GARMIN_WEBHOOK_SECRET,
 * then forwarded to the canonical webhook handlers.
 */
import { GET as webhookGET, POST as webhookPOST } from '../route'

export const dynamic = 'force-dynamic'

type Params = { token: string }

function injectSecretAsQueryParam(req: Request, token: string): Request {
  const url = new URL(req.url)
  url.searchParams.set('secret', token)

  return new Request(url.toString(), {
    method: req.method,
    headers: req.headers,
    body: req.body,
    // @ts-expect-error duplex is required for streaming request bodies
    duplex: 'half',
  })
}

export async function GET(req: Request, { params }: { params: Params }) {
  const { token } = params
  return webhookGET(injectSecretAsQueryParam(req, token))
}

export async function POST(req: Request, { params }: { params: Params }) {
  const { token } = params
  return webhookPOST(injectSecretAsQueryParam(req, token))
}
