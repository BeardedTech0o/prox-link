import type { NextApiRequest, NextApiResponse } from 'next';
import { ZodError } from 'zod';
import { requireDek } from './session';
import { PveError } from './proxmox/client';
import { SsrfError } from './ssrf';

// Shared handler helpers: consistent JSON errors, method guards, session gating.

export function sendError(res: NextApiResponse, status: number, message: string) {
  res.status(status).json({ error: message });
}

/** Gate a handler on a valid app-unlock session; returns the DEK or sends 401. */
export function withDek(
  req: NextApiRequest,
  res: NextApiResponse,
): Buffer | null {
  const dek = requireDek(req);
  if (!dek) {
    sendError(res, 401, 'Locked');
    return null;
  }
  return dek;
}

/** Map thrown errors to clean HTTP responses (never leak stack traces/secrets). */
export function handleError(res: NextApiResponse, err: unknown) {
  if (err instanceof ZodError) {
    return sendError(res, 400, err.issues.map((i) => i.message).join(', '));
  }
  if (err instanceof SsrfError) {
    return sendError(res, 400, `Blocked: ${err.message}`);
  }
  if (err instanceof PveError) {
    return res
      .status(err.status >= 400 ? err.status : 502)
      .json({ error: err.message, errors: err.errors });
  }
  const message = err instanceof Error ? err.message : 'Internal error';
  return sendError(res, 500, message);
}

export function methodNotAllowed(res: NextApiResponse, allowed: string[]) {
  res.setHeader('Allow', allowed.join(', '));
  sendError(res, 405, 'Method not allowed');
}
