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

// pages/api/console/connect.ts (a Next.js API route, bundled independently by
// Next's own webpack build) and this file's other consumer — server.ts's
// direct `tsx` import of consoleProxy.ts, entirely outside Next's bundler —
// can end up as two separate instances of this module in the same process.
// A plain module-level Map would then be invisible across that boundary:
// tickets created via the API route would never be found by the WebSocket
// upgrade handler. Back it with a value on globalThis so every instance of
// this module shares the exact same Map.
declare global {
  // eslint-disable-next-line no-var
  var __proxlinkConsoleStore: Map<string, ConsoleSession> | undefined;
}

const store = globalThis.__proxlinkConsoleStore ?? (globalThis.__proxlinkConsoleStore = new Map());

export function createConsoleSession(s: Omit<ConsoleSession, 'expires'>): string {
  const cid = randomBytes(24).toString('base64url');
  store.set(cid, { ...s, expires: Date.now() + TTL_MS });
  console.error(
    `[console] session created cid=${cid.slice(0, 10)}… mode=${s.mode} node=${s.node} vmid=${s.vmid} storeSize=${store.size}`,
  );
  return cid;
}

export type TakeSessionResult =
  | { ok: true; session: ConsoleSession }
  | { ok: false; reason: 'missing-cid' | 'not-found' | 'expired' };

export function takeConsoleSession(cid: string | undefined): TakeSessionResult {
  if (!cid) return { ok: false, reason: 'missing-cid' };
  const s = store.get(cid);
  if (!s) {
    console.error(
      `[console] lookup miss cid=${cid.slice(0, 10)}… storeSize=${store.size}`,
    );
    return { ok: false, reason: 'not-found' };
  }
  store.delete(cid); // single use
  if (Date.now() > s.expires) return { ok: false, reason: 'expired' };
  return { ok: true, session: s };
}
