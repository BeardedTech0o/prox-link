// Scales the remote framebuffer to fit entirely inside the container,
// preserving aspect ratio and cropping nothing — the whole remote screen is
// always visible (letterboxed above/below or left/right as needed), so
// nothing like a Windows taskbar or Start button ever ends up scrolled out
// of view. This is noVNC's own "contain" behavior, just re-applied after
// every resize (see below) rather than left to fire once.
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
  // RFB schedules its own post-resize update inside a requestAnimationFrame;
  // running ours a frame later lets it settle first instead of racing it.
  const reapply = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const display = rfb._display as NoVncDisplay | undefined;
        if (display) applyFitScale(display, container.clientWidth, container.clientHeight);
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
