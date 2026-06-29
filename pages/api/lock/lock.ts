import type { NextApiRequest, NextApiResponse } from 'next';
import { destroySession, readSid, clearSessionCookie } from '@/lib/session';
import { audit } from '@/lib/db';
import { methodNotAllowed } from '@/lib/api';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  destroySession(readSid(req));
  clearSessionCookie(res);
  audit('lock.lock');
  res.status(200).json({ ok: true });
}
