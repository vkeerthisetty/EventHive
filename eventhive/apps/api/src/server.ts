import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import dotenv from 'dotenv';
import { pool } from './db';
import { authenticate, csrfDefense } from './auth';
import { startOutboxWorker } from './outbox';

import { authRouter } from './routes/auth';
import { eventsRouter } from './routes/events';
import { registrationsRouter } from './routes/registrations';
import { anonRouter } from './routes/anon';
import { organizerRouter } from './routes/organizer';

dotenv.config();

export const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:5173';

// Helmet and CORS
app.use(helmet());
app.use(
  cors({
    origin: webOrigin,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());

// CSRF Defense & Authentication
app.use(csrfDefense);
app.use(authenticate);

// Static uploads serving with Cache-Control: public, max-age=86400
const uploadsDir = path.resolve(__dirname, '../uploads');
app.use(
  '/api/uploads',
  express.static(uploadsDir, {
    maxAge: '1d',
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    },
  })
);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Mount API routes under /api
app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/events', registrationsRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/me', registrationsRouter);
app.use('/api/anon', anonRouter);
app.use('/api', anonRouter);
app.use('/api/organizer', organizerRouter);

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'API route not found' },
  });
});

// Periodic event completion job (every 5 minutes as required by Section 6.1)
setInterval(async () => {
  try {
    await pool.query(
      `UPDATE events
       SET status = 'completed', updated_at = now()
       WHERE status = 'published' AND ends_at <= now()`
    );
  } catch (err) {
    // Non-blocking
  }
}, 5 * 60 * 1000);

// Start outbox worker for server-to-server retries
startOutboxWorker();

if (require.main === module) {
  app.listen(port, () => {
    console.log(`EventHive Main API listening on port ${port}`);
  });
}
