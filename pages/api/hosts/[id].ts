import type { NextApiRequest, NextApiResponse } from 'next';
import { deleteHost, getHost, audit } from '@/lib/db';
import { publicHost } from '@/lib/hosts';
import { handleError, methodNotAllowed, sendError, withDek } from '@/lib/api';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const dek = withDek(req, res);
  if (!dek) return;
  const id = String(req.query.id);

  try {
    const row = getHost(id);
    if (!row) return sendError(res, 404, 'Host not found');

    if (req.method === 'GET') {
      return res.status(200).json({ host: publicHost(row) });
    }
    if (req.method === 'DELETE') {
      deleteHost(id);
      audit('host.delete', id, row.name);
      return res.status(200).json({ ok: true });
    }
    return methodNotAllowed(res, ['GET', 'DELETE']);
  } catch (err) {
    handleError(res, err);
  }
}
