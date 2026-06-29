import { decryptString } from './crypto';
import { getHost, type HostRow } from './db';
import type { PveHost } from './proxmox/client';

/** Build a usable PveHost (with decrypted token secret) from a stored row. */
export function hostFromRow(row: HostRow, dek: Buffer): PveHost {
  return {
    baseUrl: row.base_url,
    tokenId: row.token_id,
    secret: decryptString(row.enc_secret, dek),
    tlsFingerprint: row.tls_fingerprint,
    verifyTls: row.verify_tls === 1,
  };
}

export function resolveHost(id: string, dek: Buffer): PveHost | null {
  const row = getHost(id);
  return row ? hostFromRow(row, dek) : null;
}

/** Public-safe view of a host (never includes the secret). */
export function publicHost(row: HostRow) {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    tokenId: row.token_id,
    tlsFingerprint: row.tls_fingerprint,
    verifyTls: row.verify_tls === 1,
    createdAt: row.created_at,
  };
}
