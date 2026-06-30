import { useId } from 'react';

interface RingGaugeProps {
  /** Progress as a fraction 0–1 (values outside are clamped). */
  value: number;
  /** Rendered pixel size (the SVG viewBox is always 96). */
  size?: number;
  /** Thick, chunky ring stroke width (spec: ~14–16). */
  strokeWidth?: number;
  /** Optional centered label; defaults to the rounded percentage. */
  label?: string;
  /** Optional small caption under the value. */
  caption?: string;
  className?: string;
}

// Chunky donut/ring gauge: a rose→violet gradient arc over a faint track.
// A unique gradient id per instance avoids DOM clashes when several gauges
// render on the same page.
export default function RingGauge({
  value,
  size = 96,
  strokeWidth = 15,
  label,
  caption,
  className = '',
}: RingGaugeProps) {
  const raw = useId().replace(/:/g, '');
  const gradId = `ring-grad-${raw}`;

  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const r = (96 - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const dashoffset = circumference * (1 - v);

  return (
    <div
      className={`relative inline-grid place-items-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label={label ?? `${Math.round(v * 100)}%`}>
        <defs>
          {/* Diagonal gradient across the whole SVG in user-space coords. */}
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="96" y2="96">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>

        {/* Track */}
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.07}
          strokeWidth={strokeWidth}
        />

        {/* Value arc — starts at 12 o'clock, rounded blob-like ends */}
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          transform="rotate(-90 48 48)"
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>

      <div className="absolute inset-0 grid place-items-center text-center leading-tight">
        <div>
          <div className="text-base font-semibold">{label ?? `${Math.round(v * 100)}%`}</div>
          {caption && <div className="stat-label mt-0.5">{caption}</div>}
        </div>
      </div>
    </div>
  );
}
