import type { NextApiRequest, NextApiResponse } from 'next';
import { testHost } from '@/lib/hostSetup';
import { addHostSchema } from '@/lib/validators';
import { handleError, methodNotAllowed, withDek } from '@/lib/api';

// Dry-run a connection: SSRF-check, capture fingerprint, verify the token —
// without persisting anything. Used by the "Test connection" button.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const dek = withDek(req, res);
  if (!dek) return;
  try {
    const input = addHostSchema.parse(req.body);
    const result = await testHost(input);
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    handleError(res, err);
  }
}
