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
// RFB's own resize handling (triggered by its internal ResizeObserver, or by
// toggling scaleViewport) always resets Display.scale to 1 and the viewport
// to the full framebuffer, so this must be re-applied after every resize
// rather than set once.

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
  // RFB schedules its own post-resize update inside a requestAnimationFrame;
  // running ours a frame later lets it settle first instead of racing it.
  const reapply = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const display = rfb._display as NoVncDisplay | undefined;
        if (display) applyAutoScale(display, container.clientWidth, container.clientHeight);
      });
    });
  };

  rfb.addEventListener('connect', reapply);
  window.addEventListener('resize', reapply);
  return () => {
    rfb.removeEventListener('connect', reapply);
    window.removeEventListener('resize', reapply);
  };
}
