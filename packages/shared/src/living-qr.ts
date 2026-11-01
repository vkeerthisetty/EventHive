import crypto from 'crypto';

export function computeLivingQrMac(
  qrSecret: Buffer | Uint8Array,
  registrationId: string,
  window: number
): string {
  const secretBuffer = Buffer.isBuffer(qrSecret) ? qrSecret : Buffer.from(qrSecret);
  const data = `${registrationId}.${window}`;
  const hmac = crypto.createHmac('sha256', secretBuffer).update(data).digest('hex');
  return hmac.substring(0, 20);
}

export function generateLivingQrPayload(
  qrSecret: Buffer | Uint8Array,
  registrationId: string,
  unixSeconds = Math.floor(Date.now() / 1000)
): { payload: string; window: number; secondsRemaining: number } {
  const window = Math.floor(unixSeconds / 30);
  const mac = computeLivingQrMac(qrSecret, registrationId, window);
  const secondsRemaining = 30 - (unixSeconds % 30);
  return {
    payload: `EH1.${registrationId}.${window}.${mac}`,
    window,
    secondsRemaining,
  };
}

export function parseLivingQrPayload(payload: string): {
  valid: boolean;
  registrationId?: string;
  window?: number;
  mac?: string;
} {
  const parts = payload.trim().split('.');
  if (parts.length !== 4 || parts[0] !== 'EH1') {
    return { valid: false };
  }
  const registrationId = parts[1];
  const window = parseInt(parts[2], 10);
  const mac = parts[3];

  if (!registrationId || isNaN(window) || !mac || mac.length !== 20) {
    return { valid: false };
  }
  return { valid: true, registrationId, window, mac };
}

export function verifyLivingQrPayload(
  payload: string,
  qrSecret: Buffer | Uint8Array,
  unixSeconds = Math.floor(Date.now() / 1000)
): { valid: boolean; reason?: 'EXPIRED_CODE' | 'INVALID_CODE' } {
  const parsed = parseLivingQrPayload(payload);
  if (!parsed.valid || !parsed.registrationId || parsed.window === undefined || !parsed.mac) {
    return { valid: false, reason: 'INVALID_CODE' };
  }

  const currentWindow = Math.floor(unixSeconds / 30);
  const diff = Math.abs(parsed.window - currentWindow);
  if (diff > 1) {
    return { valid: false, reason: 'EXPIRED_CODE' };
  }

  const expectedMac = computeLivingQrMac(qrSecret, parsed.registrationId, parsed.window);
  const macBuf = Buffer.from(parsed.mac);
  const expectedBuf = Buffer.from(expectedMac);

  if (macBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(macBuf, expectedBuf)) {
    return { valid: false, reason: 'INVALID_CODE' };
  }

  return { valid: true };
}
