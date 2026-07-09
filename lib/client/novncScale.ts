// Scales the remote framebuffer to the container, auto-picking between two
// strategies based on the framebuffer's own resolution:
//
//  - Low-res consoles (<=600px tall — a typical text-mode boot screen, e.g.
//    720x400 or 640x480) get cropped to fill the container completely, since
//    at "fit" scale their tiny resolution renders both mostly-black
//    letterboxing AND cramped, hard-to-read text (the exact "console far too
//    small to read" complaint this app has already been fixed for once).
//  - Higher-res consoles (a real desktop, e.g. a Windows VM at 1920x1080)
//    fit entirely inside the container with no cropping, so nothing like a
//    taskbar or Start button ever ends up scrolled out of view — trading a
//    bit of size for never hiding part of the screen.
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

const LOW_RES_HEIGHT_THRESHOLD = 600;

interface NoVncDisplay {
  width: number;
  height: number;
  clipViewport: boolean;
  scale: number;
  viewportChangeSize(width: number, height: number): void;
  viewportChangePos(deltaX: number, deltaY: number): void;
}

function applyCoverScale(display: NoVncDisplay, containerWidth: number, containerHeight: number) {
  const fbWidth = display.width;
  const fbHeight = display.height;
  const scale = Math.max(containerWidth / fbWidth, containerHeight / fbHeight);
  const vpWidth = Math.min(fbWidth, containerWidth / scale);
  const vpHeight = Math.min(fbHeight, containerHeight / scale);

  display.clipViewport = true;
  display.viewportChangeSize(vpWidth, vpHeight);
  // Center the cropped region rather than anchoring it top-left.
  display.viewportChangePos((fbWidth - vpWidth) / 2, (fbHeight - vpHeight) / 2);
  display.scale = scale;
}

function applyFitScale(display: NoVncDisplay, containerWidth: number, containerHeight: number) {
  const fbWidth = display.width;
  const fbHeight = display.height;
  const scale = Math.min(containerWidth / fbWidth, containerHeight / fbHeight);

  display.clipViewport = false;
  display.viewportChangeSize(fbWidth, fbHeight);
  display.scale = scale;
}

function applyAutoScale(display: NoVncDisplay, containerWidth: number, containerHeight: number) {
  if (!containerWidth || !containerHeight || !display.width || !display.height) return;
  if (display.height <= LOW_RES_HEIGHT_THRESHOLD) {
    applyCoverScale(display, containerWidth, containerHeight);
  } else {
    applyFitScale(display, containerWidth, containerHeight);
  }
}

export function attachFitScale(rfb: any, container: HTMLElement): () => void {
  const apply = () => {
    const display = rfb._display as NoVncDisplay | undefined;
    if (display) applyAutoScale(display, container.clientWidth, container.clientHeight);
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
