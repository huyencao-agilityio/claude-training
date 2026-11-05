import { Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'session';

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
// Dev-only fallback, like the DB defaults in data-source.ts; set SESSION_SECRET anywhere else
const DEV_SESSION_SECRET = 'dev-only-session-secret';

const logger = new Logger('SessionToken');
let warnedAboutDevSecret = false;

// Read on each call, not at import: ConfigModule loads .env after this file is imported.
// Anyone with the repo knows the dev secret and could sign a cookie, so say so once.
function sessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (!warnedAboutDevSecret) {
    warnedAboutDevSecret = true;
    logger.warn('SESSION_SECRET is not set: using the dev-only secret. Set it outside local dev.');
  }
  return DEV_SESSION_SECRET;
}

export function sessionTtlMs(): number {
  const seconds = Number(process.env.SESSION_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_TTL_SECONDS) * 1000;
}

export type SessionCheck =
  | { status: 'ok'; userId: string }
  | { status: 'expired' }
  | { status: 'invalid' };

const sign = (body: string) => createHmac('sha256', sessionSecret()).update(body).digest('base64url');

// <base64url JSON {sub, iat, exp}>.<base64url HMAC-SHA256>. The expiry counts from login, not from the
// last action (A-22).
export function signSession(userId: string, now = Date.now()): string {
  const payload = { sub: userId, iat: now, exp: now + sessionTtlMs() };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifySession(token: string, now = Date.now()): SessionCheck {
  const [body, mac, extra] = token.split('.');
  if (!body || !mac || extra !== undefined) return { status: 'invalid' };

  // The signature is checked before the payload is read, so a forged payload is never trusted
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { status: 'invalid' };
  }

  let payload: { sub?: unknown; exp?: unknown };
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { status: 'invalid' };
  }
  if (typeof payload?.sub !== 'string' || typeof payload.exp !== 'number') {
    return { status: 'invalid' };
  }
  // AC1.7: exactly 24 hours after login counts as expired
  if (now >= payload.exp) return { status: 'expired' };
  return { status: 'ok', userId: payload.sub };
}
