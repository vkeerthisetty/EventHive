import { RSABSSA } from '@cloudflare/blindrsa-ts';

export interface TokenObject { p: string; s: string; }
export const suite = RSABSSA.SHA384.PSS.Randomized();

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array {
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function canonicalJson(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJson).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
}

export function constructTokenMessage(purpose: string, eventId: string): Uint8Array {
  return new TextEncoder().encode(`EH1:${purpose}:${eventId}`);
}

export async function clientPrepareAndBlind(publicKey: CryptoKey, purpose: string, eventId: string) {
  const prepared = suite.prepare(constructTokenMessage(purpose, eventId));
  const { blindedMsg, inv } = await suite.blind(publicKey, prepared);
  return { prepared, blindedMsg, inv };
}

export async function clientFinalizeToken(publicKey: CryptoKey, prepared: Uint8Array, blindSignature: Uint8Array, inv: Uint8Array): Promise<TokenObject> {
  const signature = await suite.finalize(publicKey, prepared, blindSignature, inv);
  return { p: toBase64Url(prepared), s: toBase64Url(signature) };
}

export async function computeTokenHash(token: TokenObject): Promise<string> {
  const p = fromBase64Url(token.p); const s = fromBase64Url(token.s);
  const both = new Uint8Array(p.length + s.length); both.set(p); both.set(s, p.length);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', both);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyTokenOnCollector(token: TokenObject, publicKey: CryptoKey, purpose: string, eventId: string): Promise<{ valid: boolean; tokenHash: string; error?: string }> {
  try {
    const prepared = fromBase64Url(token.p); const signature = fromBase64Url(token.s);
    const expected = constructTokenMessage(purpose, eventId);
    if (prepared.length !== expected.length + 32) return { valid: false, tokenHash: '', error: 'INVALID_PREPARED_LENGTH' };
    const suffix = prepared.subarray(32);
    for (let i = 0; i < expected.length; i++) if (suffix[i] !== expected[i]) return { valid: false, tokenHash: '', error: 'MESSAGE_MISMATCH' };
    if (!(await suite.verify(publicKey, signature, prepared))) return { valid: false, tokenHash: '', error: 'SIGNATURE_INVALID' };
    return { valid: true, tokenHash: await computeTokenHash(token) };
  } catch (err: any) { return { valid: false, tokenHash: '', error: err.message }; }
}

export async function importPublicKeyJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey('jwk', jwk, { name: 'RSA-PSS', hash: 'SHA-384' }, true, ['verify']);
}
export async function importPrivateKeyJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey('jwk', jwk, { name: 'RSA-PSS', hash: 'SHA-384' }, true, ['sign']);
}
export async function exportKeyToJwk(key: CryptoKey): Promise<JsonWebKey> {
  return globalThis.crypto.subtle.exportKey('jwk', key);
}
