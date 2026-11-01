import crypto from 'node:crypto';
import { canonicalJson } from '@eventhive/shared';

export function computeJwkFingerprint(jwk: unknown): string {
  return crypto.createHash('sha256').update(canonicalJson(jwk), 'utf8').digest('hex');
}
export function encryptPrivateKey(jwk: unknown, secretHex: string): Buffer {
  const secret = Buffer.from(secretHex, 'hex');
  if (secret.length !== 32) throw new Error('KEY_ENCRYPTION_SECRET must be exactly 32 bytes hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secret, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(jwk), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}
export function decryptPrivateKey(buf: Buffer, secretHex: string): any {
  const secret = Buffer.from(secretHex, 'hex');
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', secret, iv); decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
}
