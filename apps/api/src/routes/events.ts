import { Router } from 'express';
import { pool } from '../db';

export const eventsRouter = Router();

function asStringArray(value: unknown): string[] {
  if (value == null) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

// GET /api/events — published event discovery, search, filters and pagination.
eventsRouter.get('/', async (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(String(req.query.pageSize || '12'), 10) || 12));
  const offset = (page - 1) * pageSize;
  const q = String(req.query.q || '').trim();
  const showPast = req.query.showPast === 'true';
  const sort = ['soonest', 'newest', 'popular'].includes(String(req.query.sort)) ? String(req.query.sort) : 'soonest';
  const categories = asStringArray(req.query.category);
  const accessibility = asStringArray(req.query.accessibility);
  const dietary = asStringArray(req.query.dietary);
  const fromDate = req.query.from ? String(req.query.from) : undefined;
  const toDate = req.query.to ? String(req.query.to) : undefined;
  const venueId = req.query.venue ? String(req.query.venue) : undefined;
  const free = req.query.free === 'true' ? true : req.query.free === 'false' ? false : undefined;

  try {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let p = 1;

    if (showPast) conditions.push(`e.status IN ('published', 'completed')`);
    else conditions.push(`e.status = 'published' AND e.ends_at > now()`);

    if (categories.length) { conditions.push(`e.category = ANY($${p++})`); values.push(categories); }
    if (accessibility.length) { conditions.push(`e.accessibility && $${p++}::text[]`); values.push(accessibility); }
    if (dietary.length) { conditions.push(`e.dietary && $${p++}::text[]`); values.push(dietary); }
    if (fromDate) { conditions.push(`e.starts_at >= $${p++}`); values.push(new Date(fromDate).toISOString()); }
    if (toDate) { conditions.push(`e.ends_at <= $${p++}`); values.push(new Date(toDate).toISOString()); }
    if (venueId) { conditions.push(`e.venue_id = $${p++}`); values.push(venueId); }
    if (free === true) conditions.push(`(e.is_paid = false OR e.price_inr = 0)`);
    if (free === false) conditions.push(`(e.is_paid = true AND e.price_inr > 0)`);
    if (q) {
      conditions.push(`(
        e.title ILIKE $${p} OR e.description ILIKE $${p} OR array_to_string(e.tags, ' ') ILIKE $${p}
        OR similarity(e.title, $${p + 1}) > 0.2
      )`);
      values.push(`%${q}%`, q);
      p += 2;
    }

    const orderBy = sort === 'newest'
      ? 'e.created_at DESC'
      : sort === 'popular'
        ? 'confirmed_count DESC, e.starts_at ASC'
        : 'e.starts_at ASC';

    const base = `
      FROM events e
      JOIN venues v ON v.id = e.venue_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS confirmed_count
        FROM registrations r
        WHERE r.event_id = e.id AND r.status = 'confirmed'
      ) rc ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS recent_count
        FROM registrations r
        WHERE r.event_id = e.id AND r.status = 'confirmed' AND r.registered_at >= now() - interval '24 hours'
      ) rr ON true
      WHERE ${conditions.join(' AND ')}
    `;

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total ${base}`, values);
    const listValues = [...values, pageSize, offset];
    const listRes = await pool.query(
      `SELECT e.id, e.title, e.description, e.category, e.starts_at, e.ends_at,
              e.venue_id, v.name AS venue_name, v.step_free AS venue_step_free,
              e.capacity, e.registration_deadline, e.banner_url, e.is_paid, e.price_inr,
              e.status, e.accessibility, e.dietary, e.tags,
              COALESCE(rc.confirmed_count, 0) AS confirmed_count,
              COALESCE(rr.recent_count, 0) AS recent_count
       ${base}
       ORDER BY ${orderBy}
       LIMIT $${p} OFFSET $${p + 1}`,
      listValues
    );

    const items = listRes.rows.map((row) => {
      const confirmedCount = Number(row.confirmed_count || 0);
      const recentCount = Number(row.recent_count || 0);
      const seatsLeft = Math.max(0, Number(row.capacity) - confirmedCount);
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        venueId: row.venue_id,
        venueName: row.venue_name,
        venueStepFree: row.venue_step_free,
        capacity: row.capacity,
        registrationDeadline: row.registration_deadline,
        bannerUrl: row.banner_url,
        isPaid: row.is_paid,
        priceInr: row.price_inr,
        status: row.status,
        accessibility: row.accessibility || [],
        dietary: row.dietary || [],
        tags: row.tags || [],
        confirmedCount,
        seatsLeft,
        isFillingFast: (row.capacity > 0 && confirmedCount / row.capacity >= 0.8) || recentCount >= 5,
      };
    });

    res.json({ items, page, pageSize, total: Number(countRes.rows[0]?.total || 0) });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// GET /api/events/filters/meta — public filter choices used by the event discovery UI.
eventsRouter.get('/filters/meta', async (_req, res) => {
  try {
    const venues = await pool.query(`SELECT id, name FROM venues ORDER BY name ASC`);
    res.json({ venues: venues.rows });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// GET /api/events/:id — public event detail plus the signed-in user's registration state.
eventsRouter.get('/:id', async (req, res) => {
  const user = (req as any).user;
  try {
    const result = await pool.query(
      `SELECT e.*, v.name AS venue_name, v.building AS venue_building,
              v.step_free AS venue_step_free, v.notes AS venue_notes,
              u.name AS organizer_name,
              COUNT(r.id) FILTER (WHERE r.status = 'confirmed')::int AS confirmed_count,
              COUNT(r.id) FILTER (WHERE r.status = 'waitlisted')::int AS waitlist_count
       FROM events e
       JOIN venues v ON v.id = e.venue_id
       JOIN users u ON u.id = e.organizer_id
       LEFT JOIN registrations r ON r.event_id = e.id
       WHERE e.id = $1 AND e.status IN ('published','completed','cancelled')
       GROUP BY e.id, v.id, u.id`,
      [req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: { code: 'EVENT_NOT_FOUND', message: 'Event not found' } });

    const event = result.rows[0];
    const confirmedCount = Number(event.confirmed_count || 0);
    const waitlistCount = Number(event.waitlist_count || 0);
    const seatsLeft = Math.max(0, Number(event.capacity) - confirmedCount);
    let userRegistration: any = null;
    let buttonState = 'open';
    let buttonReason = '';

    if (!user) buttonState = 'logged_out';
    else if (user.role !== 'student') {
      buttonState = 'disabled';
      buttonReason = 'Student accounts only';
    } else {
      const reg = await pool.query(
        `SELECT id, status, registered_at, checked_in_at FROM registrations WHERE event_id = $1 AND user_id = $2`,
        [event.id, user.id]
      );
      if (reg.rowCount) {
        userRegistration = reg.rows[0];
        if (userRegistration.status === 'confirmed') buttonState = 'registered';
        if (userRegistration.status === 'waitlisted') {
          buttonState = 'waitlisted';
          const pos = await pool.query(
            `SELECT COUNT(*)::int AS position FROM registrations
             WHERE event_id = $1 AND status = 'waitlisted' AND registered_at <= $2`,
            [event.id, userRegistration.registered_at]
          );
          userRegistration.waitlistPosition = Number(pos.rows[0]?.position || 1);
        }
      }
    }

    if (!['registered', 'waitlisted'].includes(buttonState)) {
      const now = Date.now();
      if (event.status === 'cancelled') { buttonState = 'disabled'; buttonReason = 'Event cancelled'; }
      else if (now >= new Date(event.ends_at).getTime()) { buttonState = 'disabled'; buttonReason = 'Event ended'; }
      else if (now >= new Date(event.registration_deadline).getTime()) { buttonState = 'disabled'; buttonReason = 'Registration closed'; }
      else if (seatsLeft === 0) buttonState = 'full';
    }

    const related = await pool.query(
      `SELECT e.id, e.title, e.category, e.starts_at, e.ends_at, e.banner_url,
              e.is_paid, e.price_inr, e.capacity, v.name AS venue_name,
              GREATEST(0, e.capacity - COUNT(r.id) FILTER (WHERE r.status='confirmed'))::int AS seats_left
       FROM events e JOIN venues v ON v.id=e.venue_id
       LEFT JOIN registrations r ON r.event_id=e.id
       WHERE e.category=$1 AND e.id<>$2 AND e.status='published' AND e.ends_at>now()
       GROUP BY e.id, v.id ORDER BY e.starts_at ASC LIMIT 3`,
      [event.category, event.id]
    );

    res.json({
      event: { ...event, confirmedCount, waitlistCount, seatsLeft },
      userRegistration,
      buttonState,
      buttonReason,
      relatedEvents: related.rows.map((r) => ({
        id: r.id, title: r.title, category: r.category, startsAt: r.starts_at, endsAt: r.ends_at,
        bannerUrl: r.banner_url, isPaid: r.is_paid, priceInr: r.price_inr, capacity: r.capacity,
        venueName: r.venue_name, seatsLeft: Number(r.seats_left),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// GET /api/events/:id/calendar.ics
eventsRouter.get('/:id/calendar.ics', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.title,e.description,e.starts_at,e.ends_at,v.name AS venue_name
       FROM events e JOIN venues v ON v.id=e.venue_id WHERE e.id=$1`, [req.params.id]
    );
    if (!result.rowCount) return res.status(404).send('Event not found');
    const ev = result.rows[0];
    const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const esc = (s: string) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const body = [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//EventHive//College Events//EN','BEGIN:VEVENT',
      `UID:${req.params.id}@eventhive`, `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(new Date(ev.starts_at))}`, `DTEND:${icsDate(new Date(ev.ends_at))}`,
      `SUMMARY:${esc(ev.title)}`, `DESCRIPTION:${esc(ev.description)}`, `LOCATION:${esc(ev.venue_name)}`,
      'END:VEVENT','END:VCALENDAR'
    ].join('\r\n');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="event-${req.params.id}.ics"`);
    res.send(body);
  } catch (err: any) {
    res.status(500).send('Error generating calendar file');
  }
});
