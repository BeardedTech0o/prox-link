import { randomBytes } from 'node:crypto';
import type { PveHost } from '../proxmox/client';
import type { GuestType } from '../proxmox/endpoints';

// Short-lived console sessions. The vncticket is a secret, so it lives only here
// (server memory) and is handed to the upgrade handler by an opaque cid.

export interface ConsoleSession {
  host: PveHost;
  node: string;
  type: GuestType;
  vmid: number;
  port: string;
  ticket: string;
  mode: 'vnc' | 'term';
  user: string;
  expires: number;
}

const TTL_MS = 60 * 1000; // tickets are single-use and short-lived
const store = new Map<string, ConsoleSession>();

export function createConsoleSession(s: Omit<ConsoleSession, 'expires'>): string {
  const cid = randomBytes(24).toString('base64url');
  store.set(cid, { ...s, expires: Date.now() + TTL_MS });
  return cid;
}

export function takeConsoleSession(cid: string | undefined): ConsoleSession | null {
  if (!cid) return null;
  const s = store.get(cid);
  if (!s) return null;
  store.delete(cid); // single use
  if (Date.now() > s.expires) return null;
  return s;
}
