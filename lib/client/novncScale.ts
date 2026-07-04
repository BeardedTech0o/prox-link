// noVNC's own scaleViewport option fits the remote framebuffer to the
// container while preserving its aspect ratio ("contain"), which letterboxes
// low-resolution consoles (e.g. an 80x25 text-mode boot screen) — most of the
// screen ends up black, and the handful of printed lines stay tiny. This
// instead crops the framebuffer to the container's aspect ratio and scales to
// fill it completely ("cover"), trading a little cropped margin for text
// that's actually readable.
//
// RFB's own resize handling (triggered by its internal ResizeObserver, or by
// toggling scaleViewport) always resets Display.scale to 1 and the viewport
// to the full framebuffer, so this must be re-applied after every resize
// rather than set once.

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
  if (!containerWidth || !containerHeight || !fbWidth || !fbHeight) return;

  const scale = Math.max(containerWidth / fbWidth, containerHeight / fbHeight);
  const vpWidth = Math.min(fbWidth, containerWidth / scale);
  const vpHeight = Math.min(fbHeight, containerHeight / scale);

  display.clipViewport = true;
  display.viewportChangeSize(vpWidth, vpHeight);
  // Center the cropped region rather than anchoring it top-left.
  display.viewportChangePos((fbWidth - vpWidth) / 2, (fbHeight - vpHeight) / 2);
  display.scale = scale;
}

export function attachCoverScale(rfb: any, container: HTMLElement): () => void {
  // RFB schedules its own post-resize update inside a requestAnimationFrame;
  // running ours a frame later lets it settle first instead of racing it.
  const reapply = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const display = rfb._display as NoVncDisplay | undefined;
        if (display) applyCoverScale(display, container.clientWidth, container.clientHeight);
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
