import { randomBytes } from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getMeta, setMeta } from './db';

// ── App-lock session store (OWASP A07) ───────────────────────────────────────
// The decrypted DEK lives only in server memory, bound to an opaque session id
// held in an httpOnly cookie. Sessions expire on idle + absolute timeout.

const COOKIE = 'proxlink_sid';
const IDLE_MS = 15 * 60 * 1000; // 15 min inactivity
const ABSOLUTE_MS = 12 * 60 * 60 * 1000; // 12 h hard cap

interface Session {
  dek: Buffer;
  createdAt: number;
  lastSeen: number;
}

const store = new Map<string, Session>();

export function createSession(dek: Buffer): string {
  const sid = randomBytes(32).toString('base64url');
  const now = Date.now();
  store.set(sid, { dek, createdAt: now, lastSeen: now });
  return sid;
}

export function getSession(sid: string | undefined): Session | null {
  if (!sid) return null;
  const s = store.get(sid);
  if (!s) return null;
  const now = Date.now();
  if (now - s.lastSeen > IDLE_MS || now - s.createdAt > ABSOLUTE_MS) {
    store.delete(sid);
    return null;
  }
  s.lastSeen = now;
  return s;
}

export function destroySession(sid: string | undefined): void {
  if (sid) store.delete(sid);
}

// ── cookie helpers ───────────────────────────────────────────────────────────
export function readSid(req: NextApiRequest): string | undefined {
  return req.cookies[COOKIE];
}

export function isHttps(req: NextApiRequest): boolean {
  const proto = req.headers['x-forwarded-proto'];
  const fwd = Array.isArray(proto) ? proto[0] : proto;
  if (fwd) return fwd.split(',')[0].trim().toLowerCase() === 'https';
  return Boolean((req.socket as any).encrypted);
}

export function setSessionCookie(req: NextApiRequest, res: NextApiResponse, sid: string): void {
  // Secure must reflect the actual connection, not the build mode — a Secure
  // cookie is silently dropped by browsers over plain HTTP, which is the
  // documented self-hosted LAN deployment (NODE_ENV is "production" either way).
  const secure = isHttps(req);
  res.setHeader('Set-Cookie', [
    `${COOKIE}=${sid}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${Math.floor(
      ABSOLUTE_MS / 1000,
    )}${secure ? '; Secure' : ''}`,
  ]);
}

export function clearSessionCookie(res: NextApiResponse): void {
  res.setHeader('Set-Cookie', [
    `${COOKIE}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`,
  ]);
}

/** Resolve the active session's DEK or null. Use to gate every privileged route. */
export function requireDek(req: NextApiRequest): Buffer | null {
  const s = getSession(readSid(req));
  return s ? s.dek : null;
}

// ── brute-force backoff (persisted so restarts don't reset it) ────────────────
const MAX_FAILS = 5;
const LOCK_MS = 60 * 1000;

export function lockoutState(): { lockedUntil: number; fails: number } {
  return {
    lockedUntil: Number(getMeta('lock_until') ?? '0'),
    fails: Number(getMeta('lock_fails') ?? '0'),
  };
}

export function isLockedOut(): number {
  const { lockedUntil } = lockoutState();
  const remaining = lockedUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

export function recordFail(): void {
  const fails = Number(getMeta('lock_fails') ?? '0') + 1;
  setMeta('lock_fails', String(fails));
  if (fails >= MAX_FAILS) {
    // Exponential backoff beyond the threshold.
    const factor = 2 ** (fails - MAX_FAILS);
    setMeta('lock_until', String(Date.now() + LOCK_MS * factor));
  }
}

export function recordSuccess(): void {
  setMeta('lock_fails', '0');
  setMeta('lock_until', '0');
}
