import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import AppBar from '@/components/AppBar';
import Icon from '@/components/Icon';
import { api, pvePath } from '@/lib/client/fetcher';
import { attachMobileKeyboard } from '@/lib/client/novncKeyboard';
import { attachCoverScale } from '@/lib/client/novncScale';
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

  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const keyInputRef = useRef<HTMLTextAreaElement>(null);
  const termRef = useRef<{ focus(): void } | null>(null);
  const cleanupRef = useRef<() => void>(() => {});
  const [phase, setPhase] = useState<Phase>('connecting');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'vnc' | 'term'>('vnc');

  // Neither a VNC canvas nor an xterm viewport is itself a DOM text input, so
  // mobile browsers won't pop up their on-screen keyboard on tap alone. xterm
  // manages its own hidden textarea internally (focusing it already invokes
  // the keyboard); for VNC we bridge through the hidden textarea below.
  // preventScroll stops the browser from scrolling the page to reveal the
  // (invisible, off-screen) target of the focus — without it, focusing
  // either target shoves the whole page around as soon as the keyboard opens.
  function showKeyboard() {
    if (mode === 'vnc') keyInputRef.current?.focus({ preventScroll: true });
    else termRef.current?.focus();
  }

  // The layout viewport (100vh/min-h-screen) doesn't shrink when a mobile
  // on-screen keyboard opens — only window.visualViewport does. Without this,
  // the browser instead scrolls the fixed-height page to keep the focused
  // (off-screen) keyboard-trigger element "in view", which drags the whole
  // console out from under the visible area. Track visualViewport directly
  // and size the root to it, so the console always fits above the keyboard.
  useEffect(() => {
    const root = rootRef.current;
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!root || !vv) return;
    const update = () => {
      root.style.height = `${vv.height}px`;
      root.style.top = `${vv.offsetTop}px`;
      // Reuses xterm's existing window-resize-driven fit() call; RFB's own
      // ResizeObserver picks up the container's new size independently.
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

          const focusKeyInput = () => keyInputRef.current?.focus({ preventScroll: true });
          containerRef.current!.addEventListener('touchstart', focusKeyInput);
          containerRef.current!.addEventListener('mousedown', focusKeyInput);
          const detachKeyboard = keyInputRef.current
            ? attachMobileKeyboard(rfb, keyInputRef.current)
            : () => {};
          const detachCoverScale = attachCoverScale(rfb, containerRef.current!);

          cleanupRef.current = () => {
            containerRef.current?.removeEventListener('touchstart', focusKeyInput);
            containerRef.current?.removeEventListener('mousedown', focusKeyInput);
            detachKeyboard();
            detachCoverScale();
            rfb.disconnect();
          };
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
          termRef.current = term;

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
    <div ref={rootRef} className="fixed inset-0 h-screen flex flex-col">
      <AppBar
        title="Console"
        subtitle={`${type.toUpperCase()} · #${vmid}`}
        back={`/guest/${hostId}/${type}/${vmid}`}
      />
      <div className="flex-1 relative bg-black">
        <div ref={containerRef} className="absolute inset-0 overflow-hidden" />
        {/* Off-screen but focusable: gives mobile browsers something to pop
            the on-screen keyboard up for when driving a VNC session (a
            canvas has no text input of its own). Keystrokes typed here are
            forwarded to the RFB session, not kept in the textarea. */}
        <textarea
          ref={keyInputRef}
          aria-hidden="true"
          tabIndex={-1}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className="absolute bottom-0 right-0 h-px w-px opacity-0 pointer-events-none resize-none"
          style={{ fontSize: 16 }}
        />
        {phase === 'connected' && (
          <button
            type="button"
            onClick={showKeyboard}
            aria-label="Show keyboard"
            className="absolute bottom-4 right-4 h-12 w-12 rounded-full bg-black/60 text-white grid place-items-center backdrop-blur-sm active:scale-95 transition-transform"
          >
            <Icon name="keyboard" size={22} />
          </button>
        )}
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
