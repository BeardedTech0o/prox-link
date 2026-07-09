import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { api } from '@/lib/client/fetcher';

type Phase = 'connecting' | 'connected' | 'error' | 'closed';

function wsUrl(cid: string) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/api/ws/console?cid=${encodeURIComponent(cid)}`;
}

// Shell on the Proxmox node itself (not a guest) — Proxmox's "Datacenter >
// Node > Shell". Always a terminal session, so this is a trimmed version of
// the guest console page: no VNC/noVNC branch, no mobile-keyboard bridge
// (xterm manages its own hidden textarea and already pops the keyboard up on
// tap), just xterm + the WebSocket bridge.
export default function NodeConsolePage() {
  const router = useRouter();
  const hostId = String(router.query.hostId || '');
  const node = String(router.query.node || '');

  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<() => void>(() => {});
  const [phase, setPhase] = useState<Phase>('connecting');
  const [error, setError] = useState('');

  // See the guest console page for why this is needed: the layout viewport
  // doesn't shrink when the on-screen keyboard opens, only visualViewport
  // does — without tracking it, the browser scrolls the console out from
  // under the visible area instead of the console just resizing to fit it.
  useEffect(() => {
    const root = rootRef.current;
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!root || !vv) return;
    const update = () => {
      root.style.height = `${vv.height}px`;
      root.style.top = `${vv.offsetTop}px`;
      window.dispatchEvent(new Event('resize'));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  useEffect(() => {
    if (!hostId || !node || !containerRef.current) return;
    let disposed = false;

    (async () => {
      try {
        const conn = await api<{ cid: string; mode: 'term' }>('/api/console/connect', {
          method: 'POST',
          body: JSON.stringify({ hostId, node, type: 'node' }),
        });
        if (disposed) return;

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
  }, [hostId, node]);

  return (
    <div ref={rootRef} className="fixed inset-0 h-screen bg-black">
      <div className="relative h-full">
        <div
          ref={containerRef}
          className="absolute inset-0 overflow-hidden"
          style={{ top: 'calc(env(safe-area-inset-top) + 4rem)' }}
        />
        <div
          className="absolute left-3 flex items-center gap-2 z-10"
          style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
        >
          <button
            type="button"
            onClick={() => router.push('/hosts')}
            aria-label="Go back"
            className="h-10 w-10 rounded-full bg-black/60 text-white grid place-items-center backdrop-blur-sm active:scale-95 transition-transform"
          >
            <Icon name="arrow_back" size={20} />
          </button>
          <span className="px-3 py-1.5 rounded-full bg-black/60 text-white/80 text-xs font-medium backdrop-blur-sm">
            {node}
          </span>
        </div>
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
                  Node shell needs an API token with Sys.Console privileges. Check the
                  token permissions on this host.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
