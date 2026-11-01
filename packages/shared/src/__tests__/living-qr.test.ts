import { describe, it, expect } from 'vitest';
import {
  generateLivingQrPayload,
  verifyLivingQrPayload,
  parseLivingQrPayload,
} from '../living-qr';
import crypto from 'crypto';

describe('Living QR Ticket Unit Tests', () => {
  const qrSecret = crypto.randomBytes(32);
  const regId = 'r1234567-89ab-cdef-0123-456789abcdef';

  it('generates valid living QR payload text with format EH1.<registrationId>.<window>.<mac>', () => {
    const unixSeconds = 1700000000;
    const { payload, window, secondsRemaining } = generateLivingQrPayload(
      qrSecret,
      regId,
      unixSeconds
    );

    expect(payload).toMatch(/^EH1\.r1234567-89ab-cdef-0123-456789abcdef\.\d+\.[a-f0-9]{20}$/);
    expect(window).toBe(Math.floor(unixSeconds / 30));
    expect(secondsRemaining).toBe(30 - (unixSeconds % 30));
  });

  it('accepts current window, current - 1, and current + 1', () => {
    const baseSeconds = 1700000000;
    const { payload } = generateLivingQrPayload(qrSecret, regId, baseSeconds);

    // Current window
    const check1 = verifyLivingQrPayload(payload, qrSecret, baseSeconds);
    expect(check1.valid).toBe(true);

    // Window + 1 (25 seconds later)
    const check2 = verifyLivingQrPayload(payload, qrSecret, baseSeconds + 25);
    expect(check2.valid).toBe(true);

    // Window - 1 (25 seconds earlier)
    const check3 = verifyLivingQrPayload(payload, qrSecret, baseSeconds - 25);
    expect(check3.valid).toBe(true);
  });

  it('rejects a code two windows old with EXPIRED_CODE', () => {
    const baseSeconds = 1700000000;
    const { payload } = generateLivingQrPayload(qrSecret, regId, baseSeconds);

    // 65 seconds later is 2 windows away
    const check = verifyLivingQrPayload(payload, qrSecret, baseSeconds + 65);
    expect(check.valid).toBe(false);
    expect(check.reason).toBe('EXPIRED_CODE');
  });

  it('rejects tampered mac with INVALID_CODE', () => {
    const baseSeconds = 1700000000;
    const { payload } = generateLivingQrPayload(qrSecret, regId, baseSeconds);
    const tampered = payload.substring(0, payload.length - 1) + (payload.endsWith('a') ? 'b' : 'a');

    const check = verifyLivingQrPayload(tampered, qrSecret, baseSeconds);
    expect(check.valid).toBe(false);
    expect(check.reason).toBe('INVALID_CODE');
  });
});
