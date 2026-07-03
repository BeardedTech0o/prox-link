import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import Nav from './Nav';

// Pages that own their own fullscreen layout and shouldn't get the global nav
// chrome: /lock (pre-auth, nothing to navigate to yet) and the console (an
// immersive noVNC/xterm view where a nav bar would overlap touch controls).
const NO_NAV_PREFIXES = ['/lock', '/console/'];

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hideNav = NO_NAV_PREFIXES.some((p) =>
    p.endsWith('/') ? router.pathname.startsWith(p) : router.pathname === p,
  );

  if (hideNav) return <>{children}</>;

  return (
    <>
      <Nav />
      <div className="md:pl-60">{children}</div>
    </>
  );
}
