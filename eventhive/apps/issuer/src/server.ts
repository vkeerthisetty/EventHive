import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import * as jose from 'jose';
import dotenv from 'dotenv';
import { pool } from './db';
import {
  suite,
  fromBase64Url,
  toBase64Url,
  importPrivateKeyJwk,
  exportKeyToJwk,
  IssuerIssueSchema,
  PURPOSES,
} from '@eventhive/shared';
import { computeJwkFingerprint, encryptPrivateKey, decryptPrivateKey } from './crypto-helpers';

dotenv.config();

export const app = express();
const port = parseInt(process.env.ISSUER_PORT || '3001', 10);
const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:5173';
const adminSecret = process.env.ISSUER_ADMIN_SECRET || 'issuer-admin-secret-dev-value';
const keyEncryptionSecret =
  process.env.KEY_ENCRYPTION_SECRET ||
  'deb9abc6596c50282f8f98df501e0c998c4801225dded93a5ae1adbb42f226c0';
const grantPublicKeyJwkStr =
  process.env.GRANT_PUBLIC_KEY_JWK ||
  '{"kty":"OKP","crv":"Ed25519","x":"It28VtkCVy4OdAzB1YXVIemLZnxFQphEm5YqrIDVcd4"}';

const rateLimitSecret = crypto.randomBytes(32);

// Security & Middlewares
app.use(helmet());
app.use(
  cors({
    origin: webOrigin,
    credentials: false, // Issuer allows WEB_ORIGIN without credentials
  })
);
app.use(express.json({ limit: '64kb' }));

// Custom rate limiter using HMAC(secret, ip) so raw IP is never logged or stored
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return crypto.createHmac('sha256', rateLimitSecret).update(ip).digest('hex');
  },
  handler: (req, res) => {
    res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
    });
  },
});
app.use(limiter);

// Privacy headers
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Admin secret auth middleware for /internal routes
function requireAdminSecret(req: Request, res: Response, next: NextFunction) {
  const secretHeader = req.headers['x-admin-secret'];
  if (!secretHeader || secretHeader !== adminSecret) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Invalid or missing admin secret' },
    });
  }
  next();
}

// 1. GET /health
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 2. GET /keys/:eventId/:purpose
app.get('/keys/:eventId/:purpose', async (req, res) => {
  const { eventId, purpose } = req.params;
  try {
    const dbRes = await pool.query(
      `SELECT public_key_jwk FROM event_keys WHERE event_id = $1 AND purpose = $2`,
      [eventId, purpose]
    );
    if (dbRes.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'KEY_NOT_FOUND', message: 'Keys not found for this event and purpose' },
      });
    }

    const publicKeyJwk = dbRes.rows[0].public_key_jwk;
    const fingerprint = computeJwkFingerprint(publicKeyJwk);
    res.json({
      publicKey: publicKeyJwk,
      fingerprint,
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve public key' },
    });
  }
});

// 3. POST /issue
app.post('/issue', async (req, res) => {
  const parseResult = IssuerIssueSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: parseResult.error.errors[0]?.message || 'Invalid request body' },
    });
  }

  const { grant, blindedMsgs } = parseResult.data;

  // 1. Verify grant JWT
  let grantPayload: any;
  try {
    const grantPublicKeyJwk = JSON.parse(grantPublicKeyJwkStr);
    const grantKey = await jose.importJWK(grantPublicKeyJwk, 'EdDSA');
    const verifyResult = await jose.jwtVerify(grant, grantKey, {
      audience: 'eventhive-issuer',
    });
    grantPayload = verifyResult.payload;
  } catch (err: any) {
    return res.status(401).json({
      error: { code: 'INVALID_GRANT', message: 'Grant is invalid or expired' },
    });
  }

  const userId = grantPayload.sub as string;
  const eventId = grantPayload.eventId as string;
  const purpose = grantPayload.purpose as string;

  if (!userId || !eventId || !purpose) {
    return res.status(401).json({
      error: { code: 'INVALID_GRANT', message: 'Grant missing essential claims' },
    });
  }

  // Calculate request_hash: SHA-256 of concatenated blinded messages
  const concatenatedBlinded = blindedMsgs.join('');
  const requestHash = crypto.createHash('sha256').update(concatenatedBlinded).digest('hex');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Safe retry: if issuance_log already has this request_hash, return stored signatures without incrementing
    const logRes = await client.query(
      `SELECT blind_signatures FROM issuance_log WHERE event_id = $1 AND user_id = $2 AND purpose = $3 AND request_hash = $4`,
      [eventId, userId, purpose, requestHash]
    );

    if (logRes.rowCount && logRes.rowCount > 0) {
      await client.query('COMMIT');
      return res.json({ blindSignatures: logRes.rows[0].blind_signatures });
    }

    // Load eligibility row
    const eligRes = await client.query(
      `SELECT window_start, window_end, max_tokens, issued_count
       FROM eligibility
       WHERE event_id = $1 AND user_id = $2 AND purpose = $3
       FOR UPDATE`,
      [eventId, userId, purpose]
    );

    if (eligRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: { code: 'NOT_ELIGIBLE', message: 'User is not eligible for this event and purpose' },
      });
    }

    const { window_start, window_end, max_tokens, issued_count } = eligRes.rows[0];
    const now = new Date();

    if (now < new Date(window_start) || now > new Date(window_end)) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: { code: 'OUTSIDE_WINDOW', message: 'Current time is outside the allowed eligibility window' },
      });
    }

    if (issued_count + blindedMsgs.length > max_tokens) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: { code: 'ALREADY_ISSUED', message: 'Token issuance cap exceeded' },
      });
    }

    // Load private key
    const keyRes = await client.query(
      `SELECT private_key_enc FROM event_keys WHERE event_id = $1 AND purpose = $2`,
      [eventId, purpose]
    );

    if (keyRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Event signing key not found' },
      });
    }

    const privateKeyEnc = keyRes.rows[0].private_key_enc;
    const privateKeyJwk = decryptPrivateKey(privateKeyEnc, keyEncryptionSecret);
    const privateKey = await importPrivateKeyJwk(privateKeyJwk);

    // Blind sign each message
    const signatures: string[] = [];
    for (const b64Msg of blindedMsgs) {
      const msgBytes = fromBase64Url(b64Msg);
      const sigBytes = await suite.blindSign(privateKey, msgBytes);
      signatures.push(toBase64Url(sigBytes));
    }

    // Update eligibility issued_count
    await client.query(
      `UPDATE eligibility
       SET issued_count = issued_count + $1
       WHERE event_id = $2 AND user_id = $3 AND purpose = $4`,
      [blindedMsgs.length, eventId, userId, purpose]
    );

    // Insert into issuance_log
    await client.query(
      `INSERT INTO issuance_log (event_id, user_id, purpose, request_hash, blind_signatures)
       VALUES ($1, $2, $3, $4, $5)`,
      [eventId, userId, purpose, requestHash, JSON.stringify(signatures)]
    );

    await client.query('COMMIT');
    res.json({ blindSignatures: signatures });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to issue blind signature' },
    });
  } finally {
    client.release();
  }
});

// --- Internal Admin Routes ---

// POST /internal/events/:eventId/keys: Generates keys for all purposes
app.post('/internal/events/:eventId/keys', requireAdminSecret, async (req, res) => {
  const { eventId } = req.params;
  const results = [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const purpose of PURPOSES) {
      // Check if key already exists
      const existing = await client.query(
        `SELECT public_key_jwk FROM event_keys WHERE event_id = $1 AND purpose = $2`,
        [eventId, purpose]
      );

      if (existing.rowCount && existing.rowCount > 0) {
        const pubJwk = existing.rows[0].public_key_jwk;
        results.push({
          purpose,
          publicKeyJwk: pubJwk,
          fingerprint: computeJwkFingerprint(pubJwk),
        });
        continue;
      }

      // Generate RSA 2048 key pair
      const keyPair = await suite.generateKey({
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      });

      const pubJwk = await exportKeyToJwk(keyPair.publicKey);
      const privJwk = await exportKeyToJwk(keyPair.privateKey);
      const encryptedPrivKey = encryptPrivateKey(privJwk, keyEncryptionSecret);

      await client.query(
        `INSERT INTO event_keys (event_id, purpose, public_key_jwk, private_key_enc)
         VALUES ($1, $2, $3, $4)`,
        [eventId, purpose, JSON.stringify(pubJwk), encryptedPrivKey]
      );

      results.push({
        purpose,
        publicKeyJwk: pubJwk,
        fingerprint: computeJwkFingerprint(pubJwk),
      });
    }
    await client.query('COMMIT');
    res.json({ keys: results });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  } finally {
    client.release();
  }
});

// POST /internal/eligibility: Creates eligibility rows for all four purposes
app.post('/internal/eligibility', requireAdminSecret, async (req, res) => {
  const { eventId, userId, startsAt, endsAt, feedbackWindowDays = 7 } = req.body;
  if (!eventId || !userId || !startsAt || !endsAt) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Missing eligibility parameters' },
    });
  }

  const sAt = new Date(startsAt);
  const eAt = new Date(endsAt);
  const feedbackEnd = new Date(eAt.getTime() + feedbackWindowDays * 24 * 60 * 60 * 1000);

  const configs: Array<{ purpose: string; start: Date; end: Date; maxTokens: number }> = [
    { purpose: 'feedback', start: eAt, end: feedbackEnd, maxTokens: 1 },
    { purpose: 'pulse', start: sAt, end: eAt, maxTokens: 30 },
    { purpose: 'question', start: sAt, end: eAt, maxTokens: 3 },
    { purpose: 'qvote', start: sAt, end: eAt, maxTokens: 10 },
  ];

  try {
    for (const cfg of configs) {
      await pool.query(
        `INSERT INTO eligibility (event_id, user_id, purpose, window_start, window_end, max_tokens, issued_count)
         VALUES ($1, $2, $3, $4, $5, $6, 0)
         ON CONFLICT (event_id, user_id, purpose) DO NOTHING`,
        [eventId, userId, cfg.purpose, cfg.start.toISOString(), cfg.end.toISOString(), cfg.maxTokens]
      );
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
});

// GET /internal/issued: Checks if feedback/etc pass was issued
app.get('/internal/issued', requireAdminSecret, async (req, res) => {
  const eventId = req.query.eventId as string;
  const userId = req.query.userId as string;
  const purpose = (req.query.purpose as string) || 'feedback';

  try {
    const dbRes = await pool.query(
      `SELECT issued_count FROM eligibility WHERE event_id = $1 AND user_id = $2 AND purpose = $3`,
      [eventId, userId, purpose]
    );
    const issued = dbRes.rowCount ? dbRes.rows[0].issued_count > 0 : false;
    res.json({ issued });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
});

// GET /internal/issued-count
app.get('/internal/issued-count', requireAdminSecret, async (req, res) => {
  const eventId = req.query.eventId as string;
  const purpose = (req.query.purpose as string) || 'feedback';

  try {
    const dbRes = await pool.query(
      `SELECT COUNT(DISTINCT user_id) as count FROM eligibility WHERE event_id = $1 AND purpose = $2 AND issued_count > 0`,
      [eventId, purpose]
    );
    res.json({ count: parseInt(dbRes.rows[0]?.count || '0', 10) });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
});

// GET /internal/demo/eligibility/:eventId (returns 404 unless DEMO_MODE=true)
app.get('/internal/demo/eligibility/:eventId', requireAdminSecret, async (req, res) => {
  if (process.env.DEMO_MODE !== 'true') {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Demo endpoint disabled in production' },
    });
  }

  const { eventId } = req.params;
  try {
    const dbRes = await pool.query(
      `SELECT user_id, (issued_count > 0) AS issued
       FROM eligibility
       WHERE event_id = $1 AND purpose = 'feedback'`,
      [eventId]
    );
    res.json(dbRes.rows);
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`EventHive Issuer service listening on port ${port}`);
  });
}
