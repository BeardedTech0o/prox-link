// The real fix for filling the screen completely is resizeSession (set in
// the console page): it asks the VM's own display to actually resize to
// match the available screen — the exact container box, which already
// excludes the on-screen keyboard (the root element is sized to
// visualViewport, which shrinks when the keyboard opens) and the status bar
// (the container sits below a top offset for that). When the guest's video
// driver acks that request, the framebuffer arrives already the right shape
// and this code has nothing to crop or letterbox — the fill is exact and
// nothing is cropped.
//
// Not every guest supports that though (needs a video adapter/driver that
// advertises the VNC "ExtendedDesktopSize" extension — e.g. QEMU's
// VirtIO-GPU display type with the matching guest driver; plain "Standard
// VGA" never will). For those, this falls back to fit-to-contain: the whole
// screen stays visible, undistorted, with letterbox bars rather than
// cropping a wide desktop down to a jarring, oversized sliver.
//
// noVNC's own RFB instance calls its internal _updateScale()/_updateClip()
// on every resize it observes — its own ResizeObserver on the container, and
// (now that resizeSession is on) server-driven desktop-size renegotiation —
// and those always reset Display.scale/clipViewport back to whatever
// `scaleViewport` dictates, completely independent of anything set from the
// outside. Reacting after the fact on a delay (the previous approach here)
// is a race those internal calls can win, especially now that resizeSession
// gives RFB more resize events to react to on its own. Monkey-patching
// _updateScale/_updateClip directly removes the race: whenever RFB decides a
// rescale is needed, for any reason, it calls straight into this logic
// instead of its own default.

interface NoVncDisplay {
  width: number;
  height: number;
  clipViewport: boolean;
  scale: number;
  viewportChangeSize(width: number, height: number): void;
}

function applyFitScale(display: NoVncDisplay, containerWidth: number, containerHeight: number) {
  const fbWidth = display.width;
  const fbHeight = display.height;
  if (!containerWidth || !containerHeight || !fbWidth || !fbHeight) return;

  const scale = Math.min(containerWidth / fbWidth, containerHeight / fbHeight);

  display.clipViewport = false;
  display.viewportChangeSize(fbWidth, fbHeight);
  display.scale = scale;
}

export function attachFitScale(rfb: any, container: HTMLElement): () => void {
  // noVNC centers its canvas inside `_screen` (a flex container) via
  // `margin: auto` on the canvas — relying on flexbox auto-margins to
  // resolve centering on the cross axis. In practice this leaves the canvas
  // pinned to one edge instead of centered once it's smaller than the
  // container (confirmed via an on-screen diagnostic: the computed scale and
  // canvas CSS size were exactly correct, only the position was wrong).
  // Setting alignItems/justifyContent explicitly removes any dependence on
  // that auto-margin resolution.
  const screen = rfb._screen as HTMLElement | undefined;
  if (screen) {
    screen.style.alignItems = 'center';
    screen.style.justifyContent = 'center';
  }

  const apply = () => {
    const display = rfb._display as NoVncDisplay | undefined;
    if (display) applyFitScale(display, container.clientWidth, container.clientHeight);
  };

  const originalUpdateScale = rfb._updateScale?.bind(rfb);
  const originalUpdateClip = rfb._updateClip?.bind(rfb);
  rfb._updateScale = apply;
  rfb._updateClip = apply;

  // Also reapply on our own explicit triggers (initial connect, and window
  // resize for cases RFB's own container ResizeObserver might miss, e.g. the
  // visualViewport-driven layout shifts elsewhere on this page) — a frame
  // later, so our own layout has settled first.
  const reapply = () => requestAnimationFrame(() => requestAnimationFrame(apply));
  rfb.addEventListener('connect', reapply);
  window.addEventListener('resize', reapply);

  return () => {
    rfb.removeEventListener('connect', reapply);
    window.removeEventListener('resize', reapply);
    if (originalUpdateScale) rfb._updateScale = originalUpdateScale;
    if (originalUpdateClip) rfb._updateClip = originalUpdateClip;
  };
}
