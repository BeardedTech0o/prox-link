import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getMeta, setMeta, audit } from '@/lib/db';
import { createVault } from '@/lib/crypto';
import { unlockVault } from '@/lib/crypto';
import { createSession, setSessionCookie } from '@/lib/session';
import { handleError, methodNotAllowed, sendError } from '@/lib/api';

const schema = z.object({
  pin: z.string().min(4, 'PIN must be at least 4 characters').max(128),
});

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    if (getMeta('vault_salt') !== null) {
      return sendError(res, 409, 'Already configured');
    }
    const { pin } = schema.parse(req.body);
    const { salt, wrappedDek } = createVault(pin);
    setMeta('vault_salt', salt);
    setMeta('vault_dek', wrappedDek);
    audit('lock.setup');

    // Immediately unlock so setup flows straight into the app.
    const dek = unlockVault(pin, salt, wrappedDek);
    const sid = createSession(dek);
    setSessionCookie(res, sid);
    res.status(201).json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
}
