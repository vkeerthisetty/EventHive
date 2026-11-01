import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, requireRole } from '../auth';

export const organizerRouter = Router();

// Read-only organizer overview. No create/edit/delete/participant-management routes are exposed.
organizerRouter.get('/dashboard', requireAuth, requireRole('organizer', 'admin'), async (req, res) => {
  const user = (req as any).user;
  try {
    const values: unknown[] = [];
    let ownerFilter = '';
    if (user.role !== 'admin') { values.push(user.id); ownerFilter = `WHERE e.organizer_id = $1`; }

    const result = await pool.query(
      `SELECT e.id,e.title,e.category,e.starts_at,e.ends_at,e.capacity,e.status,
              v.name AS venue_name,
              COUNT(r.id) FILTER (WHERE r.status='confirmed')::int AS registration_count,
              COUNT(r.id) FILTER (WHERE r.checked_in_at IS NOT NULL)::int AS attended_count
       FROM events e
       JOIN venues v ON v.id=e.venue_id
       LEFT JOIN registrations r ON r.event_id=e.id
       ${ownerFilter}
       GROUP BY e.id,v.id
       ORDER BY e.starts_at ASC`, values
    );

    const events = result.rows.map((row) => ({
      id: row.id, title: row.title, category: row.category, startsAt: row.starts_at,
      endsAt: row.ends_at, capacity: row.capacity, status: row.status, venueName: row.venue_name,
      registrationCount: Number(row.registration_count || 0), attendedCount: Number(row.attended_count || 0),
    }));
    res.json({
      stats: {
        totalEvents: events.length,
        totalRegistrations: events.reduce((n, e) => n + e.registrationCount, 0),
        totalAttended: events.reduce((n, e) => n + e.attendedCount, 0),
      },
      events,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});
