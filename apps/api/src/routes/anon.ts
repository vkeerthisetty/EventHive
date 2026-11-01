import { Router } from 'express';
import * as jose from 'jose';
import crypto from 'node:crypto';
import { pool } from '../db';
import { requireAuth } from '../auth';
import { AnonGrantRequestSchema } from '@eventhive/shared';

export const anonRouter = Router();

const grantPrivateKeyJwkStr = process.env.GRANT_PRIVATE_KEY_JWK || '';

// Browser obtains a short-lived identity-bound grant only after a real check-in.
// The grant is then presented to the separate issuer, which never receives feedback content.
anonRouter.post('/grant', requireAuth, async (req, res) => {
  const parseResult = AnonGrantRequestSchema.safeParse(req.body);
  if (!parseResult.success || parseResult.data.purpose !== 'feedback') {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'eventId and feedback purpose are required' },
    });
  }

  const { eventId, purpose } = parseResult.data;
  const user = (req as any).user;

  try {
    const regRes = await pool.query(
      `SELECT r.checked_in_at, e.ends_at,
              e.ends_at + (e.feedback_window_days * interval '1 day') AS feedback_window_ends_at
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       WHERE r.event_id = $1 AND r.user_id = $2 AND r.status = 'confirmed'`,
      [eventId, user.id]
    );

    if (regRes.rowCount === 0 || !regRes.rows[0].checked_in_at) {
      return res.status(403).json({
        error: { code: 'NOT_CHECKED_IN', message: 'You must be checked in to request an anonymous feedback pass' },
      });
    }

    const row = regRes.rows[0];
    const now = Date.now();
    if (now < new Date(row.ends_at).getTime()) {
      return res.status(403).json({
        error: { code: 'FEEDBACK_NOT_OPEN', message: 'Feedback opens after the event ends' },
      });
    }
    if (now > new Date(row.feedback_window_ends_at).getTime()) {
      return res.status(403).json({
        error: { code: 'FEEDBACK_CLOSED', message: 'The feedback window has closed' },
      });
    }

    if (!grantPrivateKeyJwkStr) {
      throw new Error('GRANT_PRIVATE_KEY_JWK is not configured');
    }
    const grantPrivateKeyJwk = JSON.parse(grantPrivateKeyJwkStr);
    const privateKey = await jose.importJWK(grantPrivateKeyJwk, 'EdDSA');

    const grant = await new jose.SignJWT({
      eventId,
      purpose,
      jti: crypto.randomUUID(),
    })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setAudience('eventhive-issuer')
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime('120s')
      .sign(privateKey);

    res.json({ grant });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});
