import { describe, it, expect } from 'vitest';
import {
  suite,
  clientPrepareAndBlind,
  clientFinalizeToken,
  verifyTokenOnCollector,
} from '../tokens';

describe('Blind Signatures Unit Tests', () => {
  it('runs full round trip (key, prepare, blind, sign, finalize, verify)', async () => {
    // Generate RSA 2048 key pair
    const keyPair = await suite.generateKey({
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
    });

    const eventId = '11111111-2222-3333-4444-555555555555';
    const purpose = 'feedback';

    // Client blinds
    const { prepared, blindedMsg, inv } = await clientPrepareAndBlind(
      keyPair.publicKey,
      purpose,
      eventId
    );

    // Issuer blind signs
    const blindSig = await suite.blindSign(keyPair.privateKey, blindedMsg);

    // Client finalizes
    const token = await clientFinalizeToken(keyPair.publicKey, prepared, blindSig, inv);
    expect(token.p).toBeDefined();
    expect(token.s).toBeDefined();

    // Collector verifies
    const result = await verifyTokenOnCollector(token, keyPair.publicKey, purpose, eventId);
    expect(result.valid).toBe(true);
    expect(result.tokenHash).toHaveLength(64);
  });

  it('rejects tampered signature', async () => {
    const keyPair = await suite.generateKey({
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
    });
    const eventId = '11111111-2222-3333-4444-555555555555';
    const purpose = 'feedback';

    const { prepared, blindedMsg, inv } = await clientPrepareAndBlind(
      keyPair.publicKey,
      purpose,
      eventId
    );
    const blindSig = await suite.blindSign(keyPair.privateKey, blindedMsg);
    const token = await clientFinalizeToken(keyPair.publicKey, prepared, blindSig, inv);

    // Tamper with signature
    const sigBytes = Buffer.from(token.s, 'base64url');
    sigBytes[10] ^= 0xff;
    const tamperedToken = { p: token.p, s: sigBytes.toString('base64url') };

    const result = await verifyTokenOnCollector(tamperedToken, keyPair.publicKey, purpose, eventId);
    expect(result.valid).toBe(false);
  });

  it('rejects token for wrong event', async () => {
    const keyPair = await suite.generateKey({
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
    });
    const eventId1 = '11111111-2222-3333-4444-555555555555';
    const eventId2 = '99999999-8888-7777-6666-555555555555';
    const purpose = 'feedback';

    const { prepared, blindedMsg, inv } = await clientPrepareAndBlind(
      keyPair.publicKey,
      purpose,
      eventId1
    );
    const blindSig = await suite.blindSign(keyPair.privateKey, blindedMsg);
    const token = await clientFinalizeToken(keyPair.publicKey, prepared, blindSig, inv);

    // Try to verify for eventId2
    const result = await verifyTokenOnCollector(token, keyPair.publicKey, purpose, eventId2);
    expect(result.valid).toBe(false);
  });

});
