import type { Server } from 'node:http';
import https from 'node:https';
import { parse } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { takeConsoleSession, type ConsoleSession } from './consoleStore';

// Bridges the browser's console WebSocket to the Proxmox vncwebsocket endpoint.
// The browser connects to /api/ws/console?cid=...; we look up the (secret) ticket
// server-side and relay raw frames in both directions.

const wss = new WebSocketServer({ noServer: true });

function upstreamAgent(s: ConsoleSession): https.Agent {
  const pinned = s.host.tlsFingerprint?.replace(/:/g, '').toUpperCase() || null;
  return new https.Agent({
    rejectUnauthorized: s.host.verifyTls && !pinned ? true : false,
    checkServerIdentity: (_h, cert) => {
      if (!pinned) return undefined;
      const actual = ((cert as any).fingerprint256 || '').replace(/:/g, '').toUpperCase();
      return actual === pinned ? undefined : new Error('TLS fingerprint mismatch');
    },
  });
}

function upstreamUrl(s: ConsoleSession): string {
  const base = new URL(s.host.baseUrl.replace(/\/$/, ''));
  const proto = base.protocol === 'http:' ? 'ws:' : 'wss:';
  const path = `/api2/json/nodes/${s.node}/${s.type}/${s.vmid}/vncwebsocket`;
  const qs = `port=${encodeURIComponent(s.port)}&vncticket=${encodeURIComponent(s.ticket)}`;
  return `${proto}//${base.host}${path}?${qs}`;
}

function bridge(client: WebSocket, s: ConsoleSession) {
  const upstream = new WebSocket(upstreamUrl(s), ['binary'], {
    agent: upstreamAgent(s),
    headers: { Authorization: `PVEAPIToken=${s.host.tokenId}=${s.host.secret}` },
  });

  const closeBoth = () => {
    try { client.close(); } catch {}
    try { upstream.close(); } catch {}
  };

  upstream.on('open', () => {
    // For LXC terminals the first upstream message must authenticate; we inject
    // it here so the ticket never has to be exposed to the browser.
    if (s.mode === 'term') {
      upstream.send(`${s.user}:${s.ticket}\n`);
    }
    client.on('message', (d) => upstream.readyState === WebSocket.OPEN && upstream.send(d));
    upstream.on('message', (d) => client.readyState === WebSocket.OPEN && client.send(d));
  });
  upstream.on('error', closeBoth);
  upstream.on('close', closeBoth);
  client.on('error', closeBoth);
  client.on('close', closeBoth);
}

export function attachConsoleProxy(server: Server) {
  server.on('upgrade', (req, socket, head) => {
    const { pathname, query } = parse(req.url || '', true);
    if (pathname !== '/api/ws/console') {
      // Not ours — let Next/HMR handle their own upgrades.
      return;
    }
    const cid = typeof query.cid === 'string' ? query.cid : undefined;
    const session = takeConsoleSession(cid);
    if (!session) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (client) => bridge(client, session));
  });
}
