import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import AppBar from '@/components/AppBar';
import Icon from '@/components/Icon';
import { api, pvePath } from '@/lib/client/fetcher';
import type { GuestType } from '@/lib/proxmox/endpoints';

type Phase = 'connecting' | 'connected' | 'error' | 'closed';

function wsUrl(cid: string) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/api/ws/console?cid=${encodeURIComponent(cid)}`;
}

export default function ConsolePage() {
  const router = useRouter();
  const hostId = String(router.query.hostId || '');
  const type = String(router.query.type || 'qemu') as GuestType;
  const vmid = Number(router.query.vmid || 0);

  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<() => void>(() => {});
  const [phase, setPhase] = useState<Phase>('connecting');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'vnc' | 'term'>('vnc');

  useEffect(() => {
    if (!hostId || !vmid || !containerRef.current) return;
    let disposed = false;

    (async () => {
      try {
        // Resolve node (refresh-safe deep link), then request a console ticket.
        const cr = await api<{ data: any[] }>(
          pvePath(hostId, '/cluster/resources', { type: 'vm' }),
        );
        const found = cr.data.find((r) => r.vmid === vmid && r.type === type);
        if (!found) throw new Error('Guest not found on this host');

        const conn = await api<{ cid: string; mode: 'vnc' | 'term'; password?: string }>(
          '/api/console/connect',
          {
            method: 'POST',
            body: JSON.stringify({ hostId, node: found.node, type, vmid }),
          },
        );
        if (disposed) return;
        setMode(conn.mode);

        if (conn.mode === 'vnc') {
          const { default: RFB } = await import('@novnc/novnc');
          const rfb = new RFB(containerRef.current!, wsUrl(conn.cid), {
            credentials: { password: conn.password },
          });
          rfb.scaleViewport = true;
          rfb.background = '#000';
          rfb.addEventListener('connect', () => setPhase('connected'));
          rfb.addEventListener('disconnect', () => setPhase('closed'));
          rfb.addEventListener('securityfailure', () => {
            setError('Authentication failed');
            setPhase('error');
          });
          cleanupRef.current = () => rfb.disconnect();
        } else {
          const [{ Terminal }, { FitAddon }] = await Promise.all([
            import('@xterm/xterm'),
            import('@xterm/addon-fit'),
          ]);
          const term = new Terminal({
            cursorBlink: true,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 13,
            theme: { background: '#0b0f14' },
          });
          const fit = new FitAddon();
          term.loadAddon(fit);
          term.open(containerRef.current!);
          fit.fit();

          const ws = new WebSocket(wsUrl(conn.cid));
          ws.binaryType = 'arraybuffer';
          const dec = new TextDecoder();
          ws.onopen = () => {
            setPhase('connected');
            ws.send(`1:${term.cols}:${term.rows}:`); // initial resize
          };
          ws.onmessage = (ev) => {
            const text =
              typeof ev.data === 'string' ? ev.data : dec.decode(ev.data as ArrayBuffer);
            term.write(text);
          };
          ws.onerror = () => { setError('Connection error'); setPhase('error'); };
          ws.onclose = () => setPhase('closed');
          term.onData((d) => ws.readyState === WebSocket.OPEN && ws.send(`0:${d.length}:${d}`));
          const onResize = () => {
            fit.fit();
            if (ws.readyState === WebSocket.OPEN) ws.send(`1:${term.cols}:${term.rows}:`);
          };
          window.addEventListener('resize', onResize);
          cleanupRef.current = () => {
            window.removeEventListener('resize', onResize);
            ws.close();
            term.dispose();
          };
        }
      } catch (e) {
        if (!disposed) {
          setError((e as Error).message);
          setPhase('error');
        }
      }
    })();

    return () => {
      disposed = true;
      cleanupRef.current();
    };
  }, [hostId, type, vmid]);

  return (
    <div className="min-h-screen flex flex-col">
      <AppBar
        title="Console"
        subtitle={`${type.toUpperCase()} · #${vmid}`}
        back={`/guest/${hostId}/${type}/${vmid}`}
      />
      <div className="flex-1 relative bg-black">
        <div ref={containerRef} className="absolute inset-0 overflow-hidden" />
        {phase !== 'connected' && (
          <div className="absolute inset-0 grid place-items-center text-white/80 pointer-events-none">
            <div className="flex flex-col items-center gap-2">
              <Icon
                name={phase === 'error' ? 'error' : 'cast'}
                size={32}
                className={phase === 'connecting' ? 'animate-pulse' : ''}
              />
              <p className="text-sm">
                {phase === 'connecting' && 'Connecting…'}
                {phase === 'error' && (error || 'Connection failed')}
                {phase === 'closed' && 'Disconnected'}
              </p>
              {phase === 'error' && (
                <p className="text-xs text-white/50 max-w-xs text-center px-4">
                  Console needs an API token with console privileges. Check the token
                  permissions on this host.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
