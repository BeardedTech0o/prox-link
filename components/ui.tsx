import type { ReactNode } from 'react';
import Icon from './Icon';

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-4 animate-fade-in pb-[calc(6rem_+_env(safe-area-inset-bottom))] md:pb-6">
      {children}
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex items-center gap-3">
          <div className="skeleton h-10 w-10 rounded-xl" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card flex flex-col items-center text-center gap-3 py-8">
      <Icon name="error" size={32} className="text-danger" />
      <p className="text-sm text-secondary max-w-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-2xl bg-accent text-gray-950 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  subtitle,
  action,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center text-center gap-2 py-10">
      <Icon name={icon} size={36} className="text-secondary" />
      <h3 className="font-semibold">{title}</h3>
      {subtitle && <p className="text-sm text-secondary max-w-sm">{subtitle}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  running: 'bg-success/10 text-success border-success/20',
  online: 'bg-success/10 text-success border-success/20',
  stopped: 'bg-secondary/10 text-secondary border-border',
  offline: 'bg-danger/10 text-danger border-danger/20',
  paused: 'bg-warning/10 text-warning border-warning/20',
};

export function StatusBadge({ status }: { status?: string }) {
  const s = (status || 'unknown').toLowerCase();
  const cls = STATUS_STYLES[s] || 'bg-elevated text-secondary border-border';
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border shrink-0 whitespace-nowrap ${cls}`}
    >
      {s}
    </span>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <Icon
      name="progress_activity"
      size={size}
      className="animate-[spin_0.8s_linear_infinite]"
    />
  );
}

// Proxmox doesn't report a numeric percentage for most tasks (qmcreate,
// download-url, ...), so this shows an indeterminate bar — still gives clear
// "this is actively working" feedback — alongside the task's latest log line
// as a stage description, which is the only real progress signal PVE gives us.
export function TaskProgress({ stage }: { stage: string }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      <div
        className="h-2 w-full rounded-full bg-elevated overflow-hidden"
        role="progressbar"
        aria-valuetext={stage}
      >
        <div className="h-full w-1/3 rounded-full bg-accent animate-progress-indeterminate" />
      </div>
      <p className="text-sm text-secondary truncate">{stage}</p>
    </div>
  );
}
