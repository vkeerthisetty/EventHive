import dotenv from 'dotenv';
import { pool } from './db';

dotenv.config();

const issuerUrl = process.env.ISSUER_URL || 'http://localhost:3001';
const collectorUrl = process.env.COLLECTOR_URL || 'http://localhost:3002';
const issuerAdminSecret = process.env.ISSUER_ADMIN_SECRET || 'issuer-admin-secret-dev-value';
const collectorAdminSecret = process.env.COLLECTOR_ADMIN_SECRET || 'collector-admin-secret-dev-value';

export async function queueOutbox(target: 'issuer' | 'collector', path: string, body: any) {
  await pool.query(
    `INSERT INTO outbox (target, path, body, attempts, next_attempt_at)
     VALUES ($1, $2, $3, 0, now())`,
    [target, path, JSON.stringify(body)]
  );
}

export async function sendToServer(target: 'issuer' | 'collector', path: string, body: any): Promise<any> {
  const baseUrl = target === 'issuer' ? issuerUrl : collectorUrl;
  const adminSecret = target === 'issuer' ? issuerAdminSecret : collectorAdminSecret;

  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': adminSecret,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Server ${target} returned HTTP ${res.status}: ${errText}`);
  }

  return res.json();
}

export async function processOutboxQueue() {
  try {
    const res = await pool.query(
      `SELECT id, target, path, body, attempts
       FROM outbox
       WHERE done_at IS NULL AND next_attempt_at <= now()
       ORDER BY next_attempt_at ASC
       LIMIT 10`
    );

    for (const row of res.rows) {
      try {
        await sendToServer(row.target, row.path, row.body);
        await pool.query(`UPDATE outbox SET done_at = now() WHERE id = $1`, [row.id]);
      } catch (err: any) {
        const nextAttempts = row.attempts + 1;
        // Exponential backoff: 60s * 2^attempts
        const backoffSeconds = Math.min(3600, 60 * Math.pow(2, row.attempts));
        const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();

        await pool.query(
          `UPDATE outbox
           SET attempts = $1, next_attempt_at = $2
           WHERE id = $3`,
          [nextAttempts, nextAttemptAt, row.id]
        );
      }
    }
  } catch (err) {
    // Non-blocking background error
  }
}

// Start background outbox polling every 60 seconds
let outboxInterval: NodeJS.Timeout | null = null;
export function startOutboxWorker() {
  if (!outboxInterval) {
    outboxInterval = setInterval(processOutboxQueue, 60 * 1000);
  }
}
