import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import Icon from './Icon';

interface AppBarProps {
  title: string;
  subtitle?: string;
  /** Show a back button. Pass a path, or `true` to use history back. */
  back?: string | boolean;
  /** Extra action buttons rendered before the refresh button. */
  actions?: ReactNode;
}

// Shared top title bar. The refresh button (top-right) invalidates every active
// query so the current view refetches live data from Proxmox, spinning while any
// request is in flight.
export default function AppBar({ title, subtitle, back, actions }: AppBarProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const fetching = useIsFetching();

  function goBack() {
    if (typeof back === 'string') router.push(back);
    else router.back();
  }

  function hardRefresh() {
    qc.invalidateQueries();
  }

  return (
    <header className="sticky top-0 z-20 bg-base/80 backdrop-blur-md border-b border-border">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        {back && (
          <button
            onClick={goBack}
            aria-label="Go back"
            className="btn-ghost -ml-2 flex items-center text-secondary hover:text-primary"
          >
            <Icon name="arrow_back" size={22} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-secondary truncate mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions}
        <button
          onClick={hardRefresh}
          aria-label="Refresh"
          aria-busy={fetching > 0}
          className="btn-ghost flex items-center text-secondary hover:text-accent"
        >
          <Icon
            name="refresh"
            size={22}
            className={fetching > 0 ? 'animate-[spin_0.8s_linear_infinite]' : ''}
          />
        </button>
      </div>
    </header>
  );
}
