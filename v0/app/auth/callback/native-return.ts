const IOS_CALLBACK_SOURCE = 'ios'
const IOS_CALLBACK_URL = 'runsmart://auth/callback'
const FORWARDED_PARAMETERS = [
  'code',
  'type',
  'error',
  'error_code',
  'error_description',
] as const

export function nativeReturnURL(requestURL: URL): URL | null {
  if (requestURL.searchParams.get('source') !== IOS_CALLBACK_SOURCE) {
    return null
  }

  const nativeURL = new URL(IOS_CALLBACK_URL)
  for (const name of FORWARDED_PARAMETERS) {
    const value = requestURL.searchParams.get(name)
    if (value) nativeURL.searchParams.set(name, value)
  }
  return nativeURL
}
