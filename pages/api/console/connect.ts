import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { resolveHost } from '@/lib/hosts';
import { pve } from '@/lib/proxmox/endpoints';
import { createConsoleSession } from '@/lib/server/consoleStore';
import { audit } from '@/lib/db';
import { handleError, methodNotAllowed, sendError, withDek } from '@/lib/api';

const schema = z.object({
  hostId: z.string(),
  node: z.string().regex(/^[\w.-]+$/),
  type: z.enum(['qemu', 'lxc']),
  vmid: z.number().int().positive(),
});

// Issues a console ticket and stores it server-side. The browser receives only a
// short-lived cid (+ the RFB password for VNC); the upgrade handler holds the
// real ticket. (Console with API tokens requires token privileges — flagged risk.)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const dek = withDek(req, res);
  if (!dek) return;
  try {
    const { hostId, node, type, vmid } = schema.parse(req.body);
    const host = resolveHost(hostId, dek);
    if (!host) return sendError(res, 404, 'Host not found');

    const mode = type === 'qemu' ? 'vnc' : 'term';
    const r =
      mode === 'vnc'
        ? await pve.vncproxy(host, node, type, vmid)
        : await pve.termproxy(host, node, type, vmid);
    const d = r.data as { ticket: string; port: string; user: string };

    const cid = createConsoleSession({
      host,
      node,
      type,
      vmid,
      port: String(d.port),
      ticket: d.ticket,
      user: d.user,
      mode,
    });

    audit('console.open', hostId, `${type}/${vmid}`);
    res.status(200).json({
      cid,
      mode,
      // VNC needs the ticket as the RFB password client-side; term auth is
      // injected by the proxy so the secret never reaches the browser.
      password: mode === 'vnc' ? d.ticket : undefined,
    });
  } catch (err) {
    handleError(res, err);
  }
}
