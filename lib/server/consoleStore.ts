import { randomBytes } from 'node:crypto';
import type { PveHost } from '../proxmox/client';
import type { GuestType } from '../proxmox/endpoints';

// Short-lived console sessions. The vncticket is a secret, so it lives only here
// (server memory) and is handed to the upgrade handler by an opaque cid.

export type ConsoleSession =
  | {
      kind: 'guest';
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
  | {
      // A shell on the node itself (Proxmox's "Datacenter > Node > Shell") —
      // always a terminal session, no vmid/type/VNC equivalent.
      kind: 'node';
      host: PveHost;
      node: string;
      port: string;
      ticket: string;
      mode: 'term';
      user: string;
      expires: number;
    };

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

// Plain Omit<T, K> collapses a discriminated union to the fields common to
// every member (keyof a union is an intersection), losing the 'guest' | 'node'
// narrowing this store depends on — distribute it over the union instead.
type NewConsoleSession = { [K in ConsoleSession['kind']]: Omit<Extract<ConsoleSession, { kind: K }>, 'expires'> }[ConsoleSession['kind']];

export function createConsoleSession(s: NewConsoleSession): string {
  const cid = randomBytes(24).toString('base64url');
  store.set(cid, { ...s, expires: Date.now() + TTL_MS } as ConsoleSession);
  const target = s.kind === 'guest' ? `vmid=${s.vmid}` : 'node-shell';
  console.error(
    `[console] session created cid=${cid.slice(0, 10)}… mode=${s.mode} node=${s.node} ${target} storeSize=${store.size}`,
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
