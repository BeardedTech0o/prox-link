import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'node:crypto';
import { encrypt } from '@/lib/crypto';
import { insertHost, listHosts, audit, type HostRow } from '@/lib/db';
import { publicHost } from '@/lib/hosts';
import { testHost } from '@/lib/hostSetup';
import { addHostSchema } from '@/lib/validators';
import { handleError, methodNotAllowed, withDek } from '@/lib/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const dek = withDek(req, res);
  if (!dek) return;

  if (req.method === 'GET') {
    return res.status(200).json({ hosts: listHosts().map(publicHost) });
  }

  if (req.method === 'POST') {
    try {
      const input = addHostSchema.parse(req.body);
      const result = await testHost(input); // SSRF-checked + connection verified
      const row: HostRow = {
        id: randomUUID(),
        name: input.name,
        base_url: input.baseUrl,
        token_id: input.tokenId,
        enc_secret: encrypt(input.secret, dek),
        tls_fingerprint: result.fingerprint,
        verify_tls: input.verifyTls ? 1 : 0,
        sort: listHosts().length,
        created_at: Date.now(),
      };
      insertHost(row);
      audit('host.add', row.id, input.name);
      return res.status(201).json({ host: publicHost(row), version: result.version });
    } catch (err) {
      return handleError(res, err);
    }
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}
