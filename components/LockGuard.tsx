import { useRouter } from 'next/router';
import { useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/client/fetcher';

interface LockStatus {
  configured: boolean;
  unlocked: boolean;
  lockedForMs: number;
}

// Gates the whole app behind the app-lock. Because every page is a real route
// and the session lives in an httpOnly cookie, a refresh on a deep page re-checks
// status server-side and stays put — only a locked/expired session redirects to
// /lock, which then returns the user to where they were.
export default function LockGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const onLock = router.pathname === '/lock';

  const { data, isLoading } = useQuery({
    queryKey: ['lock-status'],
    queryFn: () => api<LockStatus>('/api/lock/status'),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!data) return;
    if (!data.unlocked && !onLock) {
      const next = encodeURIComponent(router.asPath);
      router.replace(`/lock?next=${next}`);
    } else if (data.unlocked && onLock) {
      const next = typeof router.query.next === 'string' ? router.query.next : '/';
      router.replace(next);
    }
  }, [data, onLock, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="skeleton h-10 w-10 rounded-full" />
      </div>
    );
  }

  // While redirecting away from a protected page, render nothing to avoid flicker.
  if (data && !data.unlocked && !onLock) return null;

  return <>{children}</>;
}
