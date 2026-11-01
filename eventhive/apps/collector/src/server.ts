import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import * as jose from 'jose';
import dotenv from 'dotenv';
import { stringify } from 'csv-stringify/sync';
import { pool } from './db';
import {
  verifyTokenOnCollector,
  importPublicKeyJwk,
  CollectorFeedbackSchema,
  CollectorPulseSchema,
  CollectorQuestionSchema,
  CollectorVoteSchema,
} from '@eventhive/shared';

dotenv.config();

export const app = express();
const port = parseInt(process.env.COLLECTOR_PORT || '3002', 10);
const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:5173';
const adminSecret = process.env.COLLECTOR_ADMIN_SECRET || 'collector-admin-secret-dev-value';
const grantPublicKeyJwkStr =
  process.env.GRANT_PUBLIC_KEY_JWK ||
  '{"kty":"OKP","crv":"Ed25519","x":"It28VtkCVy4OdAzB1YXVIemLZnxFQphEm5YqrIDVcd4"}';

const isDemoFast = process.env.DEMO_FAST === 'true';
const cooldownSeconds = isDemoFast ? 20 : parseInt(process.env.COOLDOWN_SECONDS || '900', 10);
const minCell = parseInt(process.env.MIN_CELL || '5', 10);

const rateLimitSecret = crypto.randomBytes(32);

// Security & Middlewares
app.use(helmet());
app.use(
  cors({
    origin: webOrigin,
    credentials: false, // Collector allows WEB_ORIGIN without credentials
  })
);
// Maximum body size 8 KB as required by Section 10.6
app.use(express.json({ limit: '8kb' }));

// Custom rate limiter using HMAC(secret, ip)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
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

// Middleware to reject any Cookie or Authorization header on anonymous endpoints
function rejectIdentityMaterial(req: Request, res: Response, next: NextFunction) {
  if (req.headers.cookie || req.headers.authorization) {
    return res.status(400).json({
      error: {
        code: 'IDENTITY_MATERIAL_REJECTED',
        message: 'Anonymous submissions must not include cookies or authorization headers',
      },
    });
  }
  next();
}

// Viewer authentication for reports and pulse projector view
async function verifyViewerGrant(req: Request, res: Response, next: NextFunction) {
  const token =
    (req.headers['x-viewer-grant'] as string) ||
    (req.query.grant as string) ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined);

  if (!token) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Viewer grant required' },
    });
  }

  try {
    const grantPublicKeyJwk = JSON.parse(grantPublicKeyJwkStr);
    const grantKey = await jose.importJWK(grantPublicKeyJwk, 'EdDSA');
    const { payload } = await jose.jwtVerify(token, grantKey, {
      audience: 'eventhive-collector',
    });
    (req as any).viewer = payload;
    next();
  } catch (err: any) {
    return res.status(401).json({
      error: { code: 'INVALID_GRANT', message: 'Invalid or expired viewer grant' },
    });
  }
}

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

// Helper: load public key from database
async function getPublicKeyForEvent(
  eventId: string,
  purpose: string
): Promise<{ cryptoKey: CryptoKey; jwk: any } | null> {
  const res = await pool.query(
    `SELECT public_key_jwk FROM public_keys WHERE event_id = $1 AND purpose = $2`,
    [eventId, purpose]
  );
  if (res.rowCount === 0) return null;
  const jwk = res.rows[0].public_key_jwk;
  const cryptoKey = await importPublicKeyJwk(jwk);
  return { cryptoKey, jwk };
}

// Cryptographically secure Fisher-Yates shuffle
function cryptoShuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const randBuf = crypto.randomBytes(4);
    const randVal = randBuf.readUInt32BE(0) / 0xffffffff;
    const j = Math.floor(randVal * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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
      `SELECT public_key_jwk, fingerprint FROM public_keys WHERE event_id = $1 AND purpose = $2`,
      [eventId, purpose]
    );
    if (dbRes.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'KEY_NOT_FOUND', message: 'Public key not found' },
      });
    }
    res.json({
      publicKey: dbRes.rows[0].public_key_jwk,
      fingerprint: dbRes.rows[0].fingerprint,
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
});

// 3. GET /receipt/:tokenHash
app.get('/receipt/:tokenHash', async (req, res) => {
  const { tokenHash } = req.params;
  try {
    const dbRes = await pool.query(`SELECT 1 FROM feedback WHERE token_hash = $1`, [tokenHash]);
    res.json({ counted: dbRes.rowCount ? dbRes.rowCount > 0 : false });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
});

// 4. POST /feedback (Anonymous)
app.post('/feedback', rejectIdentityMaterial, async (req, res) => {
  const parseResult = CollectorFeedbackSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: parseResult.error.errors[0]?.message || 'Invalid feedback payload' },
    });
  }

  const {
    eventId,
    token,
    overall,
    content,
    delivery,
    venue,
    value,
    topic,
    wouldRecommend,
    comment,
  } = parseResult.data;

  // Load public key for purpose 'feedback'
  const keyObj = await getPublicKeyForEvent(eventId, 'feedback');
  if (!keyObj) {
    return res.status(400).json({
      error: { code: 'KEY_NOT_FOUND', message: 'Public key for this event does not exist' },
    });
  }

  // Verify blind signature
  const verifyResult = await verifyTokenOnCollector(token, keyObj.cryptoKey, 'feedback', eventId);
  if (!verifyResult.valid) {
    return res.status(400).json({
      error: { code: 'INVALID_TOKEN', message: verifyResult.error || 'Token verification failed' },
    });
  }

  const tokenHash = verifyResult.tokenHash;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Run insert in a transaction that takes SELECT ... FOR SHARE on events_public
    const evRes = await client.query(
      `SELECT state, sealed, feedback_window_ends_at
       FROM events_public
       WHERE event_id = $1
       FOR SHARE`,
      [eventId]
    );

    if (evRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found on collector' },
      });
    }

    const ev = evRes.rows[0];
    const now = new Date();

    if (ev.state !== 'open' || ev.sealed || now > new Date(ev.feedback_window_ends_at)) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: { code: 'FEEDBACK_CLOSED', message: 'Feedback window is closed or report is sealed' },
      });
    }

    // Check replay
    const exists = await client.query(`SELECT 1 FROM feedback WHERE token_hash = $1`, [tokenHash]);
    if (exists.rowCount && exists.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: { code: 'TOKEN_ALREADY_USED', message: 'This token has already been submitted' },
      });
    }

    // Insert feedback (strictly no timestamp, IP, or user details)
    await client.query(
      `INSERT INTO feedback (event_id, token_hash, overall, content, delivery, venue, value, topic, would_recommend, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [eventId, tokenHash, overall, content, delivery, venue, value, topic, wouldRecommend, comment || null]
    );

    await client.query('COMMIT');
    res.json({ ok: true, receipt: tokenHash });
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({
        error: { code: 'TOKEN_ALREADY_USED', message: 'Token already used' },
      });
    }
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  } finally {
    client.release();
  }
});

// 5. POST /pulse (Anonymous)
app.post('/pulse', rejectIdentityMaterial, async (req, res) => {
  const parseResult = CollectorPulseSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Invalid pulse payload' },
    });
  }

  const { eventId, token, mood } = parseResult.data;

  const keyObj = await getPublicKeyForEvent(eventId, 'pulse');
  if (!keyObj) {
    return res.status(400).json({
      error: { code: 'KEY_NOT_FOUND', message: 'Public key for pulse does not exist' },
    });
  }

  const verifyResult = await verifyTokenOnCollector(token, keyObj.cryptoKey, 'pulse', eventId);
  if (!verifyResult.valid) {
    return res.status(400).json({
      error: { code: 'INVALID_TOKEN', message: verifyResult.error || 'Token verification failed' },
    });
  }

  const tokenHash = verifyResult.tokenHash;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert into spent_tokens (unique constraint rejects replays)
    const spentRes = await client.query(
      `INSERT INTO spent_tokens (purpose, event_id, token_hash)
       VALUES ('pulse', $1, $2)
       ON CONFLICT (purpose, token_hash) DO NOTHING`,
      [eventId, tokenHash]
    );

    if (spentRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: { code: 'TOKEN_ALREADY_USED', message: 'Pulse token already spent' },
      });
    }

    // Increment pulse_buckets: 30-second aligned
    const nowSec = Math.floor(Date.now() / 1000);
    const bucketStartSec = Math.floor(nowSec / 30) * 30;
    const bucketStart = new Date(bucketStartSec * 1000).toISOString();

    await client.query(
      `INSERT INTO pulse_buckets (event_id, bucket_start, mood, count)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (event_id, bucket_start, mood)
       DO UPDATE SET count = pulse_buckets.count + 1`,
      [eventId, bucketStart, mood]
    );

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  } finally {
    client.release();
  }
});

// 6. GET /pulse/:eventId/summary?minutes=10
app.get('/pulse/:eventId/summary', verifyViewerGrant, async (req, res) => {
  const { eventId } = req.params;
  const minutes = Math.min(60, parseInt((req.query.minutes as string) || '10', 10));

  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  const last2MinSince = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  try {
    const bucketsRes = await pool.query(
      `SELECT bucket_start, mood, count
       FROM pulse_buckets
       WHERE event_id = $1 AND bucket_start >= $2
       ORDER BY bucket_start ASC`,
      [eventId, since]
    );

    // Calculate total taps in window
    let totalTapsInWindow = 0;
    const bucketsMap: Record<string, Record<string, number>> = {};

    for (const row of bucketsRes.rows) {
      const bStr = new Date(row.bucket_start).toISOString();
      if (!bucketsMap[bStr]) {
        bucketsMap[bStr] = { loving: 0, confusing: 0, lost: 0, too_slow: 0 };
      }
      bucketsMap[bStr][row.mood] = row.count;
      totalTapsInWindow += row.count;
    }

    if (totalTapsInWindow < 5) {
      return res.json({ insufficient: true });
    }

    // Totals for last 2 minutes
    const last2MinTotals: Record<string, number> = { loving: 0, confusing: 0, lost: 0, too_slow: 0 };
    let totalLast2Min = 0;

    for (const row of bucketsRes.rows) {
      if (new Date(row.bucket_start) >= new Date(last2MinSince)) {
        last2MinTotals[row.mood] = (last2MinTotals[row.mood] || 0) + row.count;
        totalLast2Min += row.count;
      }
    }

    // Banner rules: evaluated on last 2 minutes when >= 8 taps
    let banner: string | null = null;
    if (totalLast2Min >= 8) {
      const confusingPct = ((last2MinTotals.confusing + last2MinTotals.lost) / totalLast2Min) * 100;
      const tooSlowPct = (last2MinTotals.too_slow / totalLast2Min) * 100;
      const lovingPct = (last2MinTotals.loving / totalLast2Min) * 100;

      if (confusingPct >= 40) {
        banner = 'The audience is struggling. Consider a quick recap.';
      } else if (tooSlowPct >= 40) {
        banner = 'The audience wants a faster pace.';
      } else if (lovingPct >= 60) {
        banner = 'The audience is loving it.';
      }
    }

    const timeline = Object.keys(bucketsMap).sort().map((time) => ({
      time,
      ...bucketsMap[time],
    }));

    res.json({
      insufficient: false,
      totalTaps: totalTapsInWindow,
      last2MinTotals,
      totalLast2Min,
      banner,
      timeline,
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
});

// 7. GET /report/:eventId (Sealed report with lazy release)
app.get('/report/:eventId', verifyViewerGrant, async (req, res) => {
  const { eventId } = req.params;

  // Whole-event only: reject any filters
  const disallowedKeys = ['rating', 'topic', 'comment', 'date', 'from', 'to', 'q'];
  for (const k of disallowedKeys) {
    if (req.query[k] !== undefined) {
      return res.status(400).json({
        error: { code: 'FILTERS_FORBIDDEN', message: 'Report endpoint accepts whole-event data only' },
      });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check if report already sealed and stored
    const storedRes = await client.query(
      `SELECT report, released_at FROM event_reports WHERE event_id = $1`,
      [eventId]
    );
    if (storedRes.rowCount && storedRes.rowCount > 0) {
      await client.query('COMMIT');
      return res.json({ state: 'released', report: storedRes.rows[0].report, releasedAt: storedRes.rows[0].released_at });
    }

    // 2. Lock event row FOR UPDATE
    const evRes = await client.query(
      `SELECT state, closed_at, cooldown_until, sealed, feedback_window_ends_at
       FROM events_public
       WHERE event_id = $1
       FOR UPDATE`,
      [eventId]
    );

    if (evRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' },
      });
    }

    const ev = evRes.rows[0];
    const now = new Date();

    // If still open
    if (ev.state === 'open' && now <= new Date(ev.feedback_window_ends_at)) {
      await client.query('COMMIT');
      return res.json({ state: 'collecting' });
    }

    // If closed or window ended, ensure cooldown_until is set
    let cooldownUntil = ev.cooldown_until ? new Date(ev.cooldown_until) : null;
    if (!cooldownUntil && (ev.state === 'closed' || now > new Date(ev.feedback_window_ends_at))) {
      const closedAt = ev.closed_at ? new Date(ev.closed_at) : now;
      cooldownUntil = new Date(closedAt.getTime() + cooldownSeconds * 1000);
      await client.query(
        `UPDATE events_public SET state = 'closed', closed_at = $1, cooldown_until = $2 WHERE event_id = $3`,
        [closedAt.toISOString(), cooldownUntil.toISOString(), eventId]
      );
    }

    // If still in cooldown
    if (cooldownUntil && now < cooldownUntil) {
      await client.query('COMMIT');
      return res.json({
        state: 'cooldown',
        cooldownEndsAt: cooldownUntil.toISOString(),
      });
    }

    // Count feedback responses
    const countRes = await client.query(
      `SELECT COUNT(*) as count FROM feedback WHERE event_id = $1`,
      [eventId]
    );
    const responseCount = parseInt(countRes.rows[0].count, 10);

    // If fewer than MIN_CELL (5) responses -> protected
    if (responseCount < minCell) {
      await client.query('COMMIT');
      return res.json({ state: 'protected', message: 'Insufficient responses to release anonymous report' });
    }

    // All conditions met: compute report inside this transaction!
    const feedbackRows = await client.query(
      `SELECT overall, content, delivery, venue, value, topic, would_recommend, comment FROM feedback WHERE event_id = $1`,
      [eventId]
    );

    // Averages (one decimal)
    let sumOverall = 0, sumContent = 0, sumDelivery = 0, sumVenue = 0, sumValue = 0;
    let yesCount = 0, noCount = 0;
    let posCount = 0, negCount = 0; // 4..5 vs 1..3
    const topicCounts: Record<string, number> = {};
    const commentsList: string[] = [];

    for (const r of feedbackRows.rows) {
      sumOverall += r.overall;
      sumContent += r.content;
      sumDelivery += r.delivery;
      sumVenue += r.venue;
      sumValue += r.value;

      if (r.would_recommend) yesCount++;
      else noCount++;

      if (r.overall >= 4) posCount++;
      else negCount++;

      topicCounts[r.topic] = (topicCounts[r.topic] || 0) + 1;
      if (r.comment && r.comment.trim()) {
        commentsList.push(r.comment.trim());
      }
    }

    const avg = (val: number) => Math.round((val / responseCount) * 10) / 10;
    const average = {
      overall: avg(sumOverall),
      content: avg(sumContent),
      delivery: avg(sumDelivery),
      venue: avg(sumVenue),
      value: avg(sumValue),
    };

    // recommend percent: released only if both yes and no count >= 5
    let recommend: number | 'protected' = 'protected';
    if (yesCount >= 5 && noCount >= 5) {
      recommend = Math.round((yesCount / responseCount) * 100);
    }

    // positiveSplit: released only if every cell is 0 or >= 5
    let positiveSplit: { positive: number; negative: number } | 'protected' = 'protected';
    if ((posCount === 0 || posCount >= 5) && (negCount === 0 || negCount >= 5)) {
      positiveSplit = { positive: posCount, negative: negCount };
    }

    // topics: released only if every cell is 0 or >= 5
    let topics: Record<string, number> | 'protected' = 'protected';
    const allTopicCellsValid = Object.values(topicCounts).every((c) => c === 0 || c >= 5);
    if (allTopicCellsValid) {
      topics = topicCounts;
    }

    // Comments: shuffled once with cryptographically random Fisher-Yates, each { id: random uuid, text }
    const shuffledComments = cryptoShuffle(commentsList).map((text) => ({
      id: crypto.randomUUID(),
      text,
    }));

    // Pulse timeline merged into 5-minute buckets, omitting any bucket with < 5 taps
    const pulseRes = await client.query(
      `SELECT
         date_trunc('hour', bucket_start) + INTERVAL '5 min' * FLOOR(date_part('minute', bucket_start) / 5) as five_min_bucket,
         mood,
         SUM(count) as total_count
       FROM pulse_buckets
       WHERE event_id = $1
       GROUP BY 1, 2
       ORDER BY 1 ASC`,
      [eventId]
    );

    const pulseBucketsMap: Record<string, Record<string, number>> = {};
    for (const r of pulseRes.rows) {
      const bKey = new Date(r.five_min_bucket).toISOString();
      if (!pulseBucketsMap[bKey]) {
        pulseBucketsMap[bKey] = { loving: 0, confusing: 0, lost: 0, too_slow: 0, total: 0 };
      }
      const cnt = parseInt(r.total_count, 10);
      pulseBucketsMap[bKey][r.mood] = cnt;
      pulseBucketsMap[bKey].total += cnt;
    }

    const pulseTimeline = Object.keys(pulseBucketsMap)
      .filter((bKey) => pulseBucketsMap[bKey].total >= 5)
      .map((bKey) => ({
        time: bKey,
        loving: pulseBucketsMap[bKey].loving,
        confusing: pulseBucketsMap[bKey].confusing,
        lost: pulseBucketsMap[bKey].lost,
        too_slow: pulseBucketsMap[bKey].too_slow,
      }));

    const reportData = {
      responseCount,
      average,
      recommend,
      positiveSplit,
      topics,
      comments: shuffledComments,
      pulseTimeline,
    };

    // Insert into event_reports
    await client.query(
      `INSERT INTO event_reports (event_id, version, report, released_at)
       VALUES ($1, 1, $2, now())`,
      [eventId, JSON.stringify(reportData)]
    );

    // Set sealed = true
    await client.query(
      `UPDATE events_public SET sealed = true WHERE event_id = $1`,
      [eventId]
    );

    await client.query('COMMIT');
    res.json({ state: 'released', report: reportData, releasedAt: new Date().toISOString() });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  } finally {
    client.release();
  }
});

// 8. GET /report/:eventId/export.csv
app.get('/report/:eventId/export.csv', verifyViewerGrant, async (req, res) => {
  const { eventId } = req.params;
  try {
    const reportRes = await pool.query(
      `SELECT r.report, e.title
       FROM event_reports r
       JOIN events_public e ON r.event_id = e.event_id
       WHERE r.event_id = $1`,
      [eventId]
    );

    if (reportRes.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'REPORT_NOT_FOUND', message: 'Report is not released yet or does not exist' },
      });
    }

    const { report, title } = reportRes.rows[0];
    const recPercent = typeof report.recommend === 'number' ? `${report.recommend}%` : 'Protected';

    const csvData = [
      ['Event', 'Response Total', 'Overall', 'Content', 'Delivery', 'Venue', 'Value', 'Recommend Percent', 'Report Version'],
      [
        title,
        report.responseCount,
        report.average.overall,
        report.average.content,
        report.average.delivery,
        report.average.venue,
        report.average.value,
        recPercent,
        1,
      ],
    ];

    const output = stringify(csvData);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="report-${eventId}.csv"`);
    res.send(output);
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
});

// 9. P2 Question Wall endpoints
app.post('/questions', rejectIdentityMaterial, async (req, res) => {
  const parseResult = CollectorQuestionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Invalid question body' },
    });
  }

  const { eventId, token, body } = parseResult.data;
  const keyObj = await getPublicKeyForEvent(eventId, 'question');
  if (!keyObj) {
    return res.status(400).json({
      error: { code: 'KEY_NOT_FOUND', message: 'Public key for question not found' },
    });
  }

  const verifyResult = await verifyTokenOnCollector(token, keyObj.cryptoKey, 'question', eventId);
  if (!verifyResult.valid) {
    return res.status(400).json({
      error: { code: 'INVALID_TOKEN', message: 'Question token invalid' },
    });
  }

  const tokenHash = verifyResult.tokenHash;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const spentRes = await client.query(
      `INSERT INTO spent_tokens (purpose, event_id, token_hash)
       VALUES ('question', $1, $2)
       ON CONFLICT (purpose, token_hash) DO NOTHING`,
      [eventId, tokenHash]
    );

    if (spentRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: { code: 'TOKEN_ALREADY_USED', message: 'Question token already spent' },
      });
    }

    const insRes = await client.query(
      `INSERT INTO questions (event_id, body, votes, status)
       VALUES ($1, $2, 0, 'open')
       RETURNING id, body, votes, status`,
      [eventId, body]
    );

    await client.query('COMMIT');
    res.json(insRes.rows[0]);
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  } finally {
    client.release();
  }
});

app.post('/questions/:id/vote', rejectIdentityMaterial, async (req, res) => {
  const { id } = req.params;
  const parseResult = CollectorVoteSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Invalid vote payload' },
    });
  }

  const { token } = parseResult.data;

  // Load question to get eventId
  const qRes = await pool.query(`SELECT event_id FROM questions WHERE id = $1`, [id]);
  if (qRes.rowCount === 0) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Question not found' },
    });
  }
  const eventId = qRes.rows[0].event_id;

  const keyObj = await getPublicKeyForEvent(eventId, 'qvote');
  if (!keyObj) {
    return res.status(400).json({
      error: { code: 'KEY_NOT_FOUND', message: 'Public key for qvote not found' },
    });
  }

  const verifyResult = await verifyTokenOnCollector(token, keyObj.cryptoKey, 'qvote', eventId);
  if (!verifyResult.valid) {
    return res.status(400).json({
      error: { code: 'INVALID_TOKEN', message: 'Vote token invalid' },
    });
  }

  const tokenHash = verifyResult.tokenHash;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const spentRes = await client.query(
      `INSERT INTO spent_tokens (purpose, event_id, token_hash)
       VALUES ('qvote', $1, $2)
       ON CONFLICT (purpose, token_hash) DO NOTHING`,
      [eventId, tokenHash]
    );

    if (spentRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: { code: 'TOKEN_ALREADY_USED', message: 'Vote token already spent' },
      });
    }

    await client.query(`UPDATE questions SET votes = votes + 1 WHERE id = $1`, [id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  } finally {
    client.release();
  }
});

app.get('/questions/:eventId', async (req, res) => {
  const { eventId } = req.params;
  try {
    // Show wall ordered by votes descending, with ties in random order. Do not show times.
    const dbRes = await pool.query(
      `SELECT id, body, votes, status
       FROM questions
       WHERE event_id = $1 AND status != 'hidden'
       ORDER BY votes DESC, RANDOM()`,
      [eventId]
    );
    res.json(dbRes.rows);
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
});

app.patch('/questions/:id/status', verifyViewerGrant, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['open', 'answered', 'hidden'].includes(status)) {
    return res.status(400).json({
      error: { code: 'INVALID_STATUS', message: 'Invalid question status' },
    });
  }
  try {
    await pool.query(`UPDATE questions SET status = $1 WHERE id = $2`, [status, id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
});

// --- Internal Admin Routes ---

// POST /internal/events: Provisions or updates event public metadata & public keys
app.post('/internal/events', requireAdminSecret, async (req, res) => {
  const { eventId, title, startsAt, endsAt, feedbackWindowEndsAt, keys } = req.body;
  if (!eventId || !title || !startsAt || !endsAt || !feedbackWindowEndsAt) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Missing event metadata' },
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO events_public (event_id, title, starts_at, ends_at, feedback_window_ends_at, state)
       VALUES ($1, $2, $3, $4, $5, 'open')
       ON CONFLICT (event_id)
       DO UPDATE SET title = $2, starts_at = $3, ends_at = $4, feedback_window_ends_at = $5`,
      [eventId, title, startsAt, endsAt, feedbackWindowEndsAt]
    );

    if (Array.isArray(keys)) {
      for (const k of keys) {
        await client.query(
          `INSERT INTO public_keys (event_id, purpose, public_key_jwk, fingerprint)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (event_id, purpose)
           DO UPDATE SET public_key_jwk = $3, fingerprint = $4`,
          [eventId, k.purpose, JSON.stringify(k.publicKeyJwk), k.fingerprint]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  } finally {
    client.release();
  }
});

// POST /internal/events/:eventId/close
app.post('/internal/events/:eventId/close', requireAdminSecret, async (req, res) => {
  const { eventId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const evRes = await client.query(
      `SELECT sealed FROM events_public WHERE event_id = $1 FOR UPDATE`,
      [eventId]
    );
    if (evRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found' } });
    }
    if (evRes.rows[0].sealed) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: { code: 'ALREADY_SEALED', message: 'Report is already sealed' } });
    }

    const now = new Date();
    const cooldownUntil = new Date(now.getTime() + cooldownSeconds * 1000);
    const newGuard = crypto.randomUUID();

    await client.query(
      `UPDATE events_public
       SET state = 'closed', closed_at = $1, cooldown_until = $2, write_guard = $3
       WHERE event_id = $4`,
      [now.toISOString(), cooldownUntil.toISOString(), newGuard, eventId]
    );

    await client.query('COMMIT');
    res.json({ ok: true, cooldownUntil: cooldownUntil.toISOString() });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  } finally {
    client.release();
  }
});

// POST /internal/events/:eventId/reopen
app.post('/internal/events/:eventId/reopen', requireAdminSecret, async (req, res) => {
  const { eventId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const evRes = await client.query(
      `SELECT sealed FROM events_public WHERE event_id = $1 FOR UPDATE`,
      [eventId]
    );
    if (evRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Event not found' } });
    }
    if (evRes.rows[0].sealed) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: { code: 'ALREADY_SEALED', message: 'Report is already sealed and cannot reopen' } });
    }

    const newGuard = crypto.randomUUID();
    await client.query(
      `UPDATE events_public
       SET state = 'open', closed_at = NULL, cooldown_until = NULL, write_guard = $1
       WHERE event_id = $2`,
      [newGuard, eventId]
    );

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  } finally {
    client.release();
  }
});

// GET /internal/demo/feedback/:eventId
app.get('/internal/demo/feedback/:eventId', requireAdminSecret, async (req, res) => {
  if (process.env.DEMO_MODE !== 'true') {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Demo endpoint disabled in production' },
    });
  }

  const { eventId } = req.params;
  try {
    const dbRes = await pool.query(
      `SELECT SUBSTRING(token_hash FROM 1 FOR 8) as token_hash_short,
              overall, content, delivery, venue, value, topic, would_recommend, comment
       FROM feedback
       WHERE event_id = $1
       ORDER BY RANDOM()`,
      [eventId]
    );
    res.json(dbRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`EventHive Collector service listening on port ${port}`);
  });
}
