import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { requireAuth, requireRole } from '../auth';
import { CheckinPayloadSchema } from '@eventhive/shared';
import { verifyLivingQrPayload } from '../living-qr';
import { sendToServer, queueOutbox } from '../outbox';

export const registrationsRouter = Router();

// 1. POST /api/events/:id/register
registrationsRouter.post('/:id/register', requireAuth, requireRole('student'), async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock event row FOR UPDATE
    const evRes = await client.query(
      `SELECT id, title, capacity, starts_at, ends_at, registration_deadline, status
       FROM events
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (evRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' } });
    }

    const event = evRes.rows[0];
    const now = new Date();

    if (event.status !== 'published') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: { code: 'EVENT_NOT_OPEN', message: 'Event is not open for registration' } });
    }

    if (now >= new Date(event.registration_deadline) || now >= new Date(event.ends_at)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: { code: 'REGISTRATION_CLOSED', message: 'Registration has closed for this event' } });
    }

    // Check existing registration
    const existingRes = await client.query(
      `SELECT id, status, registered_at FROM registrations WHERE event_id = $1 AND user_id = $2`,
      [id, user.id]
    );

    if (existingRes.rowCount && existingRes.rowCount > 0) {
      const currentReg = existingRes.rows[0];
      if (currentReg.status === 'confirmed' || currentReg.status === 'waitlisted') {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: { code: 'ALREADY_REGISTERED', message: 'You already have an active registration for this event' },
        });
      }
    }

    // Count confirmed registrations
    const countRes = await client.query(
      `SELECT COUNT(*) as count FROM registrations WHERE event_id = $1 AND status = 'confirmed'`,
      [id]
    );
    const confirmedCount = parseInt(countRes.rows[0].count, 10);

    const isConfirmed = confirmedCount < event.capacity;
    const newStatus = isConfirmed ? 'confirmed' : 'waitlisted';
    const qrSecret = crypto.randomBytes(32);

    let registrationId: string;
    let registeredAt: string;

    if (existingRes.rowCount && existingRes.rowCount > 0) {
      // Reuse cancelled row
      registrationId = existingRes.rows[0].id;
      const updRes = await client.query(
        `UPDATE registrations
         SET status = $1, registered_at = now(), cancelled_at = NULL, qr_secret = $2
         WHERE id = $3
         RETURNING registered_at`,
        [newStatus, qrSecret, registrationId]
      );
      registeredAt = updRes.rows[0].registered_at;
    } else {
      const insRes = await client.query(
        `INSERT INTO registrations (event_id, user_id, status, qr_secret)
         VALUES ($1, $2, $3, $4)
         RETURNING id, registered_at`,
        [id, user.id, newStatus, qrSecret]
      );
      registrationId = insRes.rows[0].id;
      registeredAt = insRes.rows[0].registered_at;
    }

    let waitlistPosition: number | null = null;
    if (newStatus === 'waitlisted') {
      const posRes = await client.query(
        `SELECT COUNT(*) as rank
         FROM registrations
         WHERE event_id = $1 AND status = 'waitlisted' AND registered_at <= $2`,
        [id, registeredAt]
      );
      waitlistPosition = parseInt(posRes.rows[0].rank, 10);
    }

    await client.query('COMMIT');
    res.json({
      status: newStatus,
      waitlistPosition,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  } finally {
    client.release();
  }
});

// 2. POST /api/events/:id/cancel
registrationsRouter.post('/:id/cancel', requireAuth, requireRole('student'), async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const regRes = await client.query(
      `SELECT id, status, event_id FROM registrations WHERE event_id = $1 AND user_id = $2 FOR UPDATE`,
      [id, user.id]
    );

    if (regRes.rowCount === 0 || regRes.rows[0].status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Active registration not found' } });
    }

    const currentReg = regRes.rows[0];
    const wasConfirmed = currentReg.status === 'confirmed';

    // Set cancelled
    await client.query(
      `UPDATE registrations SET status = 'cancelled', cancelled_at = now() WHERE id = $1`,
      [currentReg.id]
    );

    // If was confirmed, promote oldest waitlisted row to confirmed in same transaction
    if (wasConfirmed) {
      const oldestRes = await client.query(
        `SELECT id, user_id FROM registrations
         WHERE event_id = $1 AND status = 'waitlisted'
         ORDER BY registered_at ASC
         LIMIT 1
         FOR UPDATE`,
        [id]
      );

      if (oldestRes.rowCount && oldestRes.rowCount > 0) {
        const promoted = oldestRes.rows[0];
        await client.query(
          `UPDATE registrations SET status = 'confirmed' WHERE id = $1`,
          [promoted.id]
        );

        // Fetch event title for notification
        const evTitleRes = await client.query(`SELECT title FROM events WHERE id = $1`, [id]);
        const title = evTitleRes.rows[0]?.title || 'the event';

        await client.query(
          `INSERT INTO notifications (user_id, type, payload)
           VALUES ($1, 'waitlist_promoted', $2)`,
          [
            promoted.user_id,
            JSON.stringify({
              eventId: id,
              title,
              message: `Good news, a seat opened up for ${title}`,
            }),
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  } finally {
    client.release();
  }
});

// GET /api/me/notifications — supports waitlist promotion visibility in the navbar.
registrationsRouter.get('/notifications', requireAuth, async (req, res) => {
  const user = (req as any).user;
  try {
    const result = await pool.query(
      `SELECT id, type, payload, read_at, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [user.id]
    );
    res.json({ notifications: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

registrationsRouter.post('/notifications/read-all', requireAuth, async (req, res) => {
  const user = (req as any).user;
  try {
    await pool.query(
      `UPDATE notifications SET read_at = now()
       WHERE user_id = $1 AND read_at IS NULL`,
      [user.id]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// 3. GET /api/registrations/:id/qr-secret
registrationsRouter.get('/:id/qr-secret', requireAuth, async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;

  try {
    const regRes = await pool.query(
      `SELECT r.id, r.user_id, r.status, r.qr_secret, e.title, u.name as student_name
       FROM registrations r
       JOIN events e ON r.event_id = e.id
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [id]
    );

    if (regRes.rowCount === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Registration not found' } });
    }

    const reg = regRes.rows[0];
    if (reg.user_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    if (reg.status !== 'confirmed') {
      return res.status(409).json({ error: { code: 'NOT_CONFIRMED', message: 'Registration is not confirmed' } });
    }

    const secretHex = Buffer.from(reg.qr_secret).toString('hex');
    res.json({
      registrationId: reg.id,
      secret: secretHex,
      studentName: reg.student_name,
      eventTitle: reg.title,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// 4. POST /api/events/:id/checkin (Organizer or Admin)
registrationsRouter.post('/:id/checkin', requireAuth, requireRole('organizer', 'admin'), async (req, res) => {
  const { id } = req.params;
  const user = (req as any).user;

  const parseResult = CheckinPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: { code: 'INVALID_PAYLOAD', message: 'Payload is required' },
    });
  }

  const { payload } = parseResult.data;

  try {
    // 1. Verify organizer authorization for this event
    const evRes = await pool.query(
      `SELECT id, organizer_id, starts_at, ends_at, feedback_window_days FROM events WHERE id = $1`,
      [id]
    );
    if (evRes.rowCount === 0) {
      return res.status(404).json({ error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' } });
    }

    const ev = evRes.rows[0];
    if (user.role !== 'admin' && ev.organizer_id !== user.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only scan check-ins for your own events' } });
    }

    // 2. Check time window: 60 minutes before starts_at until ends_at
    const now = new Date();
    const startsAt = new Date(ev.starts_at);
    const endsAt = new Date(ev.ends_at);
    const allowedStart = new Date(startsAt.getTime() - 60 * 60 * 1000);

    if (now < allowedStart || now > endsAt) {
      return res.status(403).json({
        error: { code: 'CHECKIN_CLOSED', message: 'Check-in is only allowed from 60 minutes before start until end' },
      });
    }

    // 3. Parse and verify payload
    // Payload text: EH1.<registrationId>.<window>.<mac>
    const parts = payload.trim().split('.');
    if (parts.length !== 4 || parts[0] !== 'EH1') {
      return res.status(400).json({ error: { code: 'INVALID_CODE', message: 'Malformed QR payload' } });
    }

    const regId = parts[1];
    const regRes = await pool.query(
      `SELECT r.id, r.event_id, r.user_id, r.status, r.qr_secret, r.checked_in_at,
              u.name, u.department, u.year
       FROM registrations r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [regId]
    );

    if (regRes.rowCount === 0) {
      return res.status(400).json({ error: { code: 'INVALID_CODE', message: 'Registration not found' } });
    }

    const reg = regRes.rows[0];

    // Check wrong event
    if (reg.event_id !== id) {
      return res.status(409).json({ error: { code: 'WRONG_EVENT', message: 'Ticket is for a different event' } });
    }

    // Check confirmed status
    if (reg.status !== 'confirmed') {
      return res.status(409).json({ error: { code: 'NOT_CONFIRMED', message: 'Registration is not confirmed' } });
    }

    // Verify MAC & Window
    const verifyResult = verifyLivingQrPayload(payload, reg.qr_secret);
    if (!verifyResult.valid) {
      return res.status(400).json({
        error: {
          code: verifyResult.reason || 'INVALID_CODE',
          message: verifyResult.reason === 'EXPIRED_CODE' ? 'QR code expired, please use active code' : 'Invalid QR code',
        },
      });
    }

    // Check idempotency: already checked in
    if (reg.checked_in_at) {
      return res.json({
        result: 'already_checked_in',
        student: {
          name: reg.name,
          department: reg.department,
          year: reg.year,
        },
        checkedInAt: reg.checked_in_at,
      });
    }

    // First check-in
    const checkedInAt = new Date().toISOString();
    await pool.query(`UPDATE registrations SET checked_in_at = $1 WHERE id = $2`, [checkedInAt, reg.id]);

    // Notify Issuer about eligibility
    const eligibilityPayload = {
      eventId: id,
      userId: reg.user_id,
      startsAt: ev.starts_at,
      endsAt: ev.ends_at,
      feedbackWindowDays: ev.feedback_window_days || 7,
    };

    sendToServer('issuer', '/internal/eligibility', eligibilityPayload).catch(async () => {
      // Store in outbox if call fails
      await queueOutbox('issuer', '/internal/eligibility', eligibilityPayload);
    });

    res.json({
      result: 'checked_in',
      student: {
        name: reg.name,
        department: reg.department,
        year: reg.year,
      },
      checkedInAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// 5. POST /api/events/:id/manual-checkin (Fallback manual check-in)
registrationsRouter.post('/:id/manual-checkin', requireAuth, requireRole('organizer', 'admin'), async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  const user = (req as any).user;

  try {
    const evRes = await pool.query(
      `SELECT id, organizer_id, starts_at, ends_at, feedback_window_days FROM events WHERE id = $1`,
      [id]
    );
    if (evRes.rowCount === 0) {
      return res.status(404).json({ error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' } });
    }

    const ev = evRes.rows[0];
    if (user.role !== 'admin' && ev.organizer_id !== user.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const regRes = await pool.query(
      `SELECT r.id, r.user_id, r.status, r.checked_in_at, u.name, u.department, u.year
       FROM registrations r
       JOIN users u ON r.user_id = u.id
       WHERE r.event_id = $1 AND (r.user_id = $2 OR u.roll_no = $2 OR u.email = $2)`,
      [id, userId]
    );

    if (regRes.rowCount === 0) {
      return res.status(404).json({ error: { code: 'PARTICIPANT_NOT_FOUND', message: 'Participant not found for this event' } });
    }

    const reg = regRes.rows[0];
    if (reg.status !== 'confirmed') {
      return res.status(409).json({ error: { code: 'NOT_CONFIRMED', message: 'Student is not confirmed' } });
    }

    if (reg.checked_in_at) {
      return res.json({
        result: 'already_checked_in',
        student: { name: reg.name, department: reg.department, year: reg.year },
        checkedInAt: reg.checked_in_at,
      });
    }

    const checkedInAt = new Date().toISOString();
    await pool.query(`UPDATE registrations SET checked_in_at = $1 WHERE id = $2`, [checkedInAt, reg.id]);

    const eligibilityPayload = {
      eventId: id,
      userId: reg.user_id,
      startsAt: ev.starts_at,
      endsAt: ev.ends_at,
      feedbackWindowDays: ev.feedback_window_days || 7,
    };

    sendToServer('issuer', '/internal/eligibility', eligibilityPayload).catch(async () => {
      await queueOutbox('issuer', '/internal/eligibility', eligibilityPayload);
    });

    res.json({
      result: 'checked_in',
      student: { name: reg.name, department: reg.department, year: reg.year },
      checkedInAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// 6. GET /api/me/clashes?eventId=<id> (Section 7.3)
registrationsRouter.get('/clashes', requireAuth, requireRole('student'), async (req, res) => {
  const eventId = req.query.eventId as string;
  const user = (req as any).user;

  if (!eventId) {
    return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'eventId query parameter is required' } });
  }

  try {
    const targetRes = await pool.query(`SELECT starts_at, ends_at FROM events WHERE id = $1`, [eventId]);
    if (targetRes.rowCount === 0) {
      return res.status(404).json({ error: { code: 'EVENT_NOT_FOUND', message: 'Target event not found' } });
    }

    const target = targetRes.rows[0];

    // Find student's confirmed registrations for published events that overlap target event
    const clashesRes = await pool.query(
      `SELECT e.id, e.title, e.starts_at, e.ends_at
       FROM registrations r
       JOIN events e ON r.event_id = e.id
       WHERE r.user_id = $1
         AND r.status = 'confirmed'
         AND e.id != $2
         AND e.status = 'published'
         AND e.starts_at < $3
         AND e.ends_at > $4`,
      [user.id, eventId, target.ends_at, target.starts_at]
    );

    res.json({ clashes: clashesRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// 7. GET /api/me/events (Section 6.4)
registrationsRouter.get('/events', requireAuth, async (req, res) => {
  const user = (req as any).user;
  const tab = (req.query.tab as string) || 'upcoming'; // upcoming, waitlisted, past, cancelled

  try {
    let whereClause = 'r.user_id = $1';
    const values: any[] = [user.id];

    if (tab === 'upcoming') {
      whereClause += ` AND r.status = 'confirmed' AND e.ends_at > now()`;
    } else if (tab === 'waitlisted') {
      whereClause += ` AND r.status = 'waitlisted' AND e.ends_at > now()`;
    } else if (tab === 'past') {
      whereClause += ` AND r.status = 'confirmed' AND e.ends_at <= now()`;
    } else if (tab === 'cancelled') {
      whereClause += ` AND r.status = 'cancelled'`;
    }

    const sql = `
      SELECT
        r.id as registration_id, r.status as registration_status,
        r.registered_at, r.checked_in_at,
        e.id as event_id, e.title, e.category, e.starts_at, e.ends_at,
        e.banner_url, e.require_feedback_for_certificate,
        v.name as venue_name
      FROM registrations r
      JOIN events e ON r.event_id = e.id
      JOIN venues v ON e.venue_id = v.id
      WHERE ${whereClause}
      ORDER BY e.starts_at ASC
    `;

    const dbRes = await pool.query(sql, values);
    const items = dbRes.rows;

    // For waitlisted, compute positions
    if (tab === 'waitlisted') {
      for (const item of items) {
        const posRes = await pool.query(
          `SELECT COUNT(*) as rank
           FROM registrations
           WHERE event_id = $1 AND status = 'waitlisted' AND registered_at <= $2`,
          [item.event_id, item.registered_at]
        );
        item.waitlistPosition = parseInt(posRes.rows[0].rank, 10);
      }
    }

    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});
