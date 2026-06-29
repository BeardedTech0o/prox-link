import https from 'node:https';
import { URL } from 'node:url';

// ── Proxmox VE REST client ───────────────────────────────────────────────────
// Token auth (PVEAPIToken). Talks straight to <base>/api2/json. Handles the two
// realities of homelab Proxmox: self-signed certs (pin by SHA-256 fingerprint)
// and the urlencoded body format the API expects.

export interface PveHost {
  baseUrl: string; // e.g. https://10.0.0.10:8006
  tokenId: string; // user@realm!tokenname
  secret: string; // token UUID
  tlsFingerprint?: string | null; // sha256, colon-hex, uppercase
  verifyTls?: boolean; // verify against system CAs instead of pinning
}

export interface PveResponse<T = any> {
  status: number;
  data: T;
  errors?: Record<string, string>;
}

export class PveError extends Error {
  status: number;
  errors?: Record<string, string>;
  constructor(message: string, status: number, errors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

function authHeader(h: PveHost): string {
  return `PVEAPIToken=${h.tokenId}=${h.secret}`;
}

function normaliseFingerprint(fp: string): string {
  return fp.replace(/:/g, '').toUpperCase();
}

function agentFor(h: PveHost): https.Agent {
  const pinned = h.tlsFingerprint ? normaliseFingerprint(h.tlsFingerprint) : null;
  // When pinning a self-signed cert we cannot also require CA validation, so we
  // disable the default check and assert the exact fingerprint ourselves.
  const rejectUnauthorized = h.verifyTls && !pinned ? true : false;
  return new https.Agent({
    rejectUnauthorized,
    checkServerIdentity: (_host, cert) => {
      if (!pinned) return undefined; // rely on rejectUnauthorized (CA) path
      const actual = normaliseFingerprint((cert as any).fingerprint256 || '');
      if (actual !== pinned) {
        return new Error('TLS fingerprint mismatch');
      }
      return undefined;
    },
  });
}

interface RequestOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | undefined>;
  body?: Record<string, string | number | boolean | undefined>;
}

export function pveRequest<T = any>(
  h: PveHost,
  path: string,
  opts: RequestOpts = {},
): Promise<PveResponse<T>> {
  const method = opts.method ?? 'GET';
  const base = new URL(h.baseUrl.replace(/\/$/, ''));
  const url = new URL(`${base.pathname.replace(/\/$/, '')}/api2/json${path}`, base);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  let bodyStr = '';
  const headers: Record<string, string> = {
    Authorization: authHeader(h),
    Accept: 'application/json',
  };
  if (opts.body && (method === 'POST' || method === 'PUT')) {
    const form = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.body)) {
      if (v !== undefined) form.set(k, String(v));
    }
    bodyStr = form.toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Content-Length'] = String(Buffer.byteLength(bodyStr));
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method, headers, agent: agentFor(h), timeout: 15000 },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          const status = res.statusCode ?? 0;
          let parsed: any = null;
          try {
            parsed = text ? JSON.parse(text) : null;
          } catch {
            // PVE returns HTML for some auth failures.
          }
          if (status >= 400) {
            reject(
              new PveError(
                parsed?.message || `Proxmox responded ${status}`,
                status,
                parsed?.errors,
              ),
            );
            return;
          }
          resolve({ status, data: parsed?.data as T, errors: parsed?.errors });
        });
      },
    );
    req.on('error', (e) => reject(new PveError(e.message, 0)));
    req.on('timeout', () => req.destroy(new PveError('Request timed out', 0)));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/** Connect once (no validation) to capture the cert SHA-256 for pinning. */
export function probeTls(
  baseUrl: string,
): Promise<{ fingerprint256: string; authorized: boolean }> {
  const u = new URL(baseUrl.replace(/\/$/, ''));
  return new Promise((resolve, reject) => {
    const req = https.request(
      u,
      {
        method: 'HEAD',
        rejectUnauthorized: false,
        agent: new https.Agent({ rejectUnauthorized: false }),
        timeout: 10000,
      },
      (res) => {
        const socket = res.socket as import('tls').TLSSocket;
        const cert = socket.getPeerCertificate();
        resolve({
          fingerprint256: (cert as any).fingerprint256 || '',
          authorized: socket.authorized,
        });
        res.resume();
      },
    );
    req.on('error', (e) => reject(new PveError(e.message, 0)));
    req.on('timeout', () => req.destroy(new PveError('Probe timed out', 0)));
    req.end();
  });
}
