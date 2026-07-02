import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getMeta, audit } from '@/lib/db';
import { unlockVault } from '@/lib/crypto';
import {
  createSession,
  setSessionCookie,
  isLockedOut,
  recordFail,
  recordSuccess,
} from '@/lib/session';
import { handleError, methodNotAllowed, sendError } from '@/lib/api';

const schema = z.object({ pin: z.string().min(1).max(128) });

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const remaining = isLockedOut();
    if (remaining > 0) {
      return res
        .status(429)
        .json({ error: 'Too many attempts', lockedForMs: remaining });
    }
    const salt = getMeta('vault_salt');
    const wrapped = getMeta('vault_dek');
    if (!salt || !wrapped) return sendError(res, 409, 'Not configured');

    const { pin } = schema.parse(req.body);
    let dek: Buffer;
    try {
      dek = unlockVault(pin, salt, wrapped); // throws on wrong PIN (GCM auth)
    } catch {
      recordFail();
      audit('lock.fail');
      return sendError(res, 401, 'Incorrect PIN');
    }
    recordSuccess();
    const sid = createSession(dek);
    setSessionCookie(req, res, sid);
    audit('lock.unlock');
    res.status(200).json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
}
