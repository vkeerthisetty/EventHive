import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from '../db';
import {
  hashPassword,
  comparePassword,
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
} from '../auth';
import {
  SignupStudentSchema,
  SignupOrganizerSchema,
  LoginSchema,
  ProfileUpdateSchema,
} from '@eventhive/shared';

export const authRouter = Router();

// Rate limit /api/auth/* to 10 requests per minute per IP
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: {
      code: 'AUTH_RATE_LIMIT',
      message: 'Too many authentication attempts, please try again in a minute',
    },
  },
});
authRouter.use(authLimiter);

// POST /api/auth/signup
authRouter.post('/signup', async (req, res) => {
  const isOrganizer = !!req.body.organizerCode;

  if (isOrganizer) {
    const parseResult = SignupOrganizerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: parseResult.error.errors[0]?.message || 'Invalid input' },
      });
    }

    const { name, email, password, department, year, organizerCode } = parseResult.data;
    if (organizerCode !== process.env.ORGANIZER_SIGNUP_CODE) {
      return res.status(400).json({
        error: { code: 'INVALID_ORGANIZER_CODE', message: 'Organizer signup code is invalid' },
      });
    }

    try {
      const exists = await pool.query(`SELECT 1 FROM users WHERE email = $1`, [email]);
      if (exists.rowCount && exists.rowCount > 0) {
        return res.status(409).json({
          error: { code: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists' },
        });
      }

      const passHash = await hashPassword(password);
      const userRes = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, department, year)
         VALUES ($1, $2, $3, 'organizer', $4, $5)
         RETURNING id, name, email, role, department, year`,
        [name, email, passHash, department, year]
      );

      const user = userRes.rows[0];
      const token = await createSessionToken(user);
      setSessionCookie(res, token);
      return res.status(201).json({ user });
    } catch (err: any) {
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  } else {
    // Student signup
    const parseResult = SignupStudentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: parseResult.error.errors[0]?.message || 'Invalid input' },
      });
    }

    const { name, email, password, department, year, roll_no } = parseResult.data;
    try {
      const exists = await pool.query(`SELECT 1 FROM users WHERE email = $1`, [email]);
      if (exists.rowCount && exists.rowCount > 0) {
        return res.status(409).json({
          error: { code: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists' },
        });
      }

      const passHash = await hashPassword(password);
      const userRes = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, department, year, roll_no)
         VALUES ($1, $2, $3, 'student', $4, $5, $6)
         RETURNING id, name, email, role, department, year, roll_no`,
        [name, email, passHash, department, year, roll_no || null]
      );

      const user = userRes.rows[0];
      const token = await createSessionToken(user);
      setSessionCookie(res, token);
      return res.status(201).json({ user });
    } catch (err: any) {
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: err.message },
      });
    }
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  const parseResult = LoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', message: parseResult.error.errors[0]?.message || 'Invalid email or password' },
    });
  }

  const { email, password } = parseResult.data;
  try {
    const userRes = await pool.query(
      `SELECT id, name, email, password_hash, role, department, year, roll_no
       FROM users WHERE email = $1`,
      [email]
    );

    if (userRes.rowCount === 0) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password' },
      });
    }

    const user = userRes.rows[0];
    const match = await comparePassword(password, user.password_hash);
    if (!match) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password' },
      });
    }

    const userSession = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      year: user.year,
    };

    const token = await createSessionToken(userSession);
    setSessionCookie(res, token);

    delete user.password_hash;
    return res.json({ user });
  } catch (err: any) {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me
authRouter.get('/me', async (req, res) => {
  const sessionUser = (req as any).user;
  if (!sessionUser) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Not logged in' },
    });
  }

  try {
    const userRes = await pool.query(
      `SELECT id, name, email, role, department, year, roll_no, bio, interests, open_to_team
       FROM users WHERE id = $1`,
      [sessionUser.id]
    );

    if (userRes.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const skillsRes = await pool.query(
      `SELECT s.id, s.slug, s.label, s.skill_group, us.level
       FROM user_skills us
       JOIN skills s ON us.skill_id = s.id
       WHERE us.user_id = $1`,
      [sessionUser.id]
    );

    const user = userRes.rows[0];
    user.skills = skillsRes.rows;

    res.json({ user });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
});

// PATCH /api/me/profile
authRouter.patch('/profile', requireAuth, async (req, res) => {
  const sessionUser = (req as any).user;
  const parseResult = ProfileUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', message: parseResult.error.errors[0]?.message || 'Invalid input' },
    });
  }

  const { bio, open_to_team, interests, skills } = parseResult.data;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (bio !== undefined) {
      updates.push(`bio = $${idx++}`);
      values.push(bio);
    }
    if (open_to_team !== undefined) {
      updates.push(`open_to_team = $${idx++}`);
      values.push(open_to_team);
    }
    if (interests !== undefined) {
      updates.push(`interests = $${idx++}`);
      values.push(interests);
    }

    if (updates.length > 0) {
      values.push(sessionUser.id);
      await client.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`,
        values
      );
    }

    // Update skills if provided
    if (skills !== undefined) {
      await client.query(`DELETE FROM user_skills WHERE user_id = $1`, [sessionUser.id]);
      for (const sk of skills) {
        await client.query(
          `INSERT INTO user_skills (user_id, skill_id, level) VALUES ($1, $2, $3)`,
          [sessionUser.id, sk.skill_id, sk.level]
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
