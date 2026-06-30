import type { NextApiRequest, NextApiResponse } from 'next';
import { getMeta } from '@/lib/db';
import { getSession, readSid, isLockedOut } from '@/lib/session';
import { methodNotAllowed } from '@/lib/api';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const configured = getMeta('vault_salt') !== null;
  const unlocked = getSession(readSid(req)) !== null;
  res.status(200).json({
    configured,
    unlocked,
    lockedForMs: isLockedOut(),
  });
}
