import Link from 'next/link';
import { useRouter } from 'next/router';
import Icon from './Icon';

const TABS = [
  { href: '/', icon: 'dashboard', label: 'Guests' },
  { href: '/hosts', icon: 'dns', label: 'Hosts' },
  { href: '/tasks', icon: 'receipt_long', label: 'Tasks' },
  { href: '/settings', icon: 'settings', label: 'Settings' },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

// Responsive app navigation: a fixed left sidebar on desktop, a fixed bottom
// bar on mobile. Rendered once, globally, by AppShell.
export default function Nav() {
  const router = useRouter();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-60 md:bg-surface md:border-r md:border-border md:z-30">
        <div className="px-5 py-5">
          <span className="text-xl font-bold tracking-tight">ProxLink</span>
        </div>
        <nav className="flex-1 flex flex-col gap-1 px-3">
          {TABS.map((t) => {
            const active = isActive(router.pathname, t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'text-accent' : 'text-secondary hover:text-primary hover:bg-elevated'
                }`}
              >
                <Icon name={t.icon} size={22} />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/90 backdrop-blur-md border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          {TABS.map((t) => {
            const active = isActive(router.pathname, t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-accent' : 'text-secondary hover:text-primary'
                }`}
              >
                <Icon name={t.icon} size={24} className={active ? 'text-accent' : ''} />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
