import { useEffect, useState } from 'react';

// TEMPORARY diagnostic overlay — remove once the mobile Safari horizontal
// overflow bug (reported repeatedly, unreproducible in this environment's
// Chromium-only headless testing, and confirmed to affect every page rather
// than any specific component) is actually root-caused. Reports the real
// numbers from the affected device instead of guessing from screenshots.
export default function ViewportDebug() {
  const [info, setInfo] = useState<Record<string, string | number>>({});

  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport;
      setInfo({
        innerWidth: window.innerWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        vvWidth: vv ? Math.round(vv.width) : 'n/a',
        vvScale: vv ? vv.scale.toFixed(2) : 'n/a',
        dpr: window.devicePixelRatio,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div className="fixed bottom-16 left-1 z-50 rounded-lg bg-black/80 px-2 py-1 font-mono text-[10px] leading-tight text-white md:bottom-1">
      {Object.entries(info).map(([k, v]) => (
        <div key={k}>
          {k}: {v}
        </div>
      ))}
    </div>
  );
}
