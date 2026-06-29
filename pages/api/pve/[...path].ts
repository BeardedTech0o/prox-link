import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveHost } from '@/lib/hosts';
import { pveRequest } from '@/lib/proxmox/client';
import { isAllowed } from '@/lib/proxmox/allowlist';
import { assertSafeUrl, isoDownloadAllowsPrivate } from '@/lib/ssrf';
import { audit } from '@/lib/db';
import { handleError, methodNotAllowed, sendError, withDek } from '@/lib/api';

// Generic, allowlisted bridge to a host's PVE API. The client sends the PVE
// path + ?hostId=...; we authorise the (method, path) pair, decrypt the token,
// and forward. Arbitrary passthrough is impossible (OWASP A01).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const dek = withDek(req, res);
  if (!dek) return;

  const method = req.method as 'GET' | 'POST' | 'PUT' | 'DELETE';
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
    return methodNotAllowed(res, ['GET', 'POST', 'PUT', 'DELETE']);
  }

  const { path: pathParts, hostId, ...rest } = req.query;
  const path = '/' + (Array.isArray(pathParts) ? pathParts.join('/') : pathParts ?? '');
  if (!hostId || typeof hostId !== 'string') {
    return sendError(res, 400, 'Missing hostId');
  }
  if (!isAllowed(method, path)) {
    return sendError(res, 403, `Not permitted: ${method} ${path}`);
  }

  try {
    const host = resolveHost(hostId, dek);
    if (!host) return sendError(res, 404, 'Host not found');

    // SSRF guard for the ISO download feature: PVE will fetch body.url.
    if (path.endsWith('/download-url') && req.body?.url) {
      assertSafeUrl(String(req.body.url), {
        allowPrivate: isoDownloadAllowsPrivate(),
        schemes: ['http:', 'https:'],
      });
    }

    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (typeof v === 'string') query[k] = v;
    }

    const result = await pveRequest(host, path, {
      method,
      query: method === 'GET' ? query : undefined,
      body: method === 'GET' ? undefined : (req.body ?? {}),
    });

    if (method !== 'GET') audit(`pve.${method}`, hostId, path);
    res.status(result.status || 200).json({ data: result.data });
  } catch (err) {
    handleError(res, err);
  }
}
