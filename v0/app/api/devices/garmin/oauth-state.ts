import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';

interface OAuthStatePayload {
  userId: number;
  redirectUri: string;
  nonce: string;
  createdAt: number;
  expiresAt: number;
  codeVerifier: string; // PKCE code verifier — stored server-side, never sent to browser
}

function getStateSecret() {
  return process.env.ENCRYPTION_KEY || 'dev-encryption-key-change-in-production';
}

function signStatePayload(payload: OAuthStatePayload) {
  const payloadString = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', getStateSecret())
    .update(payloadString)
    .digest('base64url');

  return `${payloadString}.${signature}`;
}

function verifyAndParseState(state: string): OAuthStatePayload | null {
  const dotIndex = state.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const encodedPayload = state.slice(0, dotIndex);
  const providedSignature = state.slice(dotIndex + 1);

  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = createHmac('sha256', getStateSecret())
    .update(encodedPayload)
    .digest('base64url');

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as OAuthStatePayload;

    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch (error) {
    logger.error('Failed to parse OAuth state payload', error);
    return null;
  }
}

function generateCodeVerifier(): string {
  // RFC 7636: 43-128 unreserved chars [A-Z a-z 0-9 - . _ ~]
  return randomBytes(64).toString('base64url').slice(0, 128);
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

function generateSignedState(userId: number, redirectUri: string, codeVerifier: string) {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  return signStatePayload({
    userId,
    redirectUri,
    codeVerifier,
    createdAt: Date.now(),
    expiresAt,
    nonce: randomBytes(16).toString('hex')
  });
}

export { generateSignedState, verifyAndParseState, generateCodeVerifier, generateCodeChallenge };
