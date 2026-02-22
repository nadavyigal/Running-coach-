import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function getEncryptionKey() {
  const baseKey = process.env.ENCRYPTION_KEY;
  if (!baseKey && process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY must be configured in production');
  }

  const resolvedKey = baseKey || 'dev-encryption-key-change-in-production';
  return createHash('sha256').update(resolvedKey).digest();
}

function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);

  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
}

function decryptToken(payload: string) {
  const [ivHex, encryptedHex, authTagHex] = payload.split(':');

  if (!ivHex || !encryptedHex || !authTagHex) {
    throw new Error('Invalid token format');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivHex, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

export { decryptToken, encryptToken };
