import Link from 'next/link';
import { useRouter } from 'next/router';
import Icon from './Icon';

const TABS = [
  { href: '/', icon: 'dashboard', label: 'Guests' },
  { href: '/tasks', icon: 'receipt_long', label: 'Tasks' },
  { href: '/hosts', icon: 'dns', label: 'Hosts' },
  { href: '/settings', icon: 'settings', label: 'Settings' },
];

export default function BottomNav() {
  const router = useRouter();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-surface/90 backdrop-blur-md border-t border-border">
      <div className="max-w-3xl mx-auto grid grid-cols-4">
        {TABS.map((t) => {
          const active =
            t.href === '/' ? router.pathname === '/' : router.pathname.startsWith(t.href);
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
  );
}
