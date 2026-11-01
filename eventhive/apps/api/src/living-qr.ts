import crypto from 'node:crypto';

function computeMac(secret: Buffer | Uint8Array, registrationId: string, window: number): string {
  return crypto.createHmac('sha256', Buffer.from(secret)).update(`${registrationId}.${window}`).digest('hex').slice(0, 20);
}

export function verifyLivingQrPayload(
  payload: string,
  secret: Buffer | Uint8Array,
  unixSeconds = Math.floor(Date.now() / 1000)
): { valid: boolean; reason?: 'EXPIRED_CODE' | 'INVALID_CODE' } {
  const [prefix, registrationId, windowRaw, mac] = payload.trim().split('.');
  const window = Number.parseInt(windowRaw || '', 10);
  if (prefix !== 'EH1' || !registrationId || !Number.isInteger(window) || !/^[0-9a-f]{20}$/i.test(mac || '')) {
    return { valid: false, reason: 'INVALID_CODE' };
  }
  const current = Math.floor(unixSeconds / 30);
  if (Math.abs(window - current) > 1) return { valid: false, reason: 'EXPIRED_CODE' };
  const expected = computeMac(secret, registrationId, window);
  const a = Buffer.from(mac, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { valid: false, reason: 'INVALID_CODE' };
  return { valid: true };
}
