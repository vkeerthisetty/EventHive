import { Request, Response, NextFunction } from 'express';
import * as jose from 'jose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Role } from '@eventhive/shared';

dotenv.config();

const sessionSecret = process.env.SESSION_SECRET || 'super-secret-session-secret-change-in-production-min32';
const secretKey = new TextEncoder().encode(sessionSecret);
const webOrigin = process.env.WEB_ORIGIN || 'http://localhost:5173';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  year: number;
}

export async function createSessionToken(user: UserSession): Promise<string> {
  return new jose.SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
}

export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secretKey);
    return payload as unknown as UserSession;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie('eh_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie('eh_session', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// CSRF Defense middleware for state-changing requests
export function csrfDefense(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const origin = req.headers.origin;
    if (origin !== webOrigin) {
      return res.status(403).json({
        error: { code: 'CSRF_VIOLATION', message: 'Forbidden: Origin does not match WEB_ORIGIN' },
      });
    }

    const contentType = req.headers['content-type'] || '';
    // If request contains body and is not multipart form-data (file upload)
    if (req.body && Object.keys(req.body).length > 0 && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
      return res.status(403).json({
        error: { code: 'INVALID_CONTENT_TYPE', message: 'State-changing requests must send application/json' },
      });
    }
  }
  next();
}

// Authenticate user middleware (populates req.user if session cookie is valid)
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.eh_session;
  if (!token) {
    (req as any).user = null;
    return next();
  }

  const session = await verifySessionToken(token);
  (req as any).user = session;
  next();
}

// Require logged-in user
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as UserSession | null;
  if (!user) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Please log in to continue' },
    });
  }
  next();
}

// Require specific role(s)
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as UserSession | null;
    if (!user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Please log in to continue' },
      });
    }
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource' },
      });
    }
    next();
  };
}
