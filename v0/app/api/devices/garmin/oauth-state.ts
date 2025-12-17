import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';

interface OAuthStatePayload {
  userId: number;
  redirectUri: string;
  nonce: string;
  createdAt: number;
  expiresAt: number;
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
  const [encodedPayload, providedSignature] = state.split('.');

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

function generateSignedState(userId: number, redirectUri: string) {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  return signStatePayload({
    userId,
    redirectUri,
    createdAt: Date.now(),
    expiresAt,
    nonce: randomBytes(16).toString('hex')
  });
}

export { generateSignedState, verifyAndParseState };