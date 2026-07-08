import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AppBar from '@/components/AppBar';
import Icon from '@/components/Icon';
import { PageShell } from '@/components/ui';
import {
  ACCENTS,
  getAccent,
  getTheme,
  setAccent,
  setTheme,
  type AccentKey,
  type ThemeMode,
} from '@/lib/theme';
import { api } from '@/lib/client/fetcher';

export default function SettingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [accent, setAccentState] = useState<AccentKey>('lime');

  useEffect(() => {
    setThemeState(getTheme());
    setAccentState(getAccent());
  }, []);

  function chooseTheme(m: ThemeMode) {
    setTheme(m);
    setThemeState(m);
  }
  function chooseAccent(a: AccentKey) {
    setAccent(a);
    setAccentState(a);
  }

  async function lockNow() {
    await api('/api/lock/lock', { method: 'POST' });
    qc.clear();
    router.replace('/lock');
  }

  return (
    <>
      <AppBar title="Settings" />
      <PageShell>
        <section className="card flex flex-col gap-3">
          <h2 className="font-semibold">Appearance</h2>
          <div className="flex flex-col gap-2">
            <span className="stat-label">Theme</span>
            <div className="flex gap-2">
              {(['light', 'dark'] as ThemeMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => chooseTheme(m)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border capitalize flex items-center gap-2 transition-colors ${
                    theme === m
                      ? 'bg-accent/[0.12] border-accent/20 text-accent'
                      : 'border-border text-secondary hover:text-primary'
                  }`}
                >
                  <Icon name={m === 'dark' ? 'dark_mode' : 'light_mode'} size={18} />
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="stat-label">Accent</span>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(ACCENTS) as AccentKey[]).map((a) => (
                <button
                  key={a}
                  aria-label={a}
                  onClick={() => chooseAccent(a)}
                  className={`h-9 w-9 rounded-full border-2 transition-transform ${
                    accent === a ? 'scale-110 border-primary' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: `rgb(${ACCENTS[a][0]})` }}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="card flex flex-col gap-3">
          <h2 className="font-semibold">Security</h2>
          <p className="text-sm text-secondary">
            Your Proxmox tokens are encrypted with your PIN and only decrypted in
            memory while unlocked.
          </p>
          <button
            onClick={lockNow}
            className="px-4 py-2 rounded-xl bg-elevated text-sm font-medium hover:bg-border/40 transition-colors flex items-center gap-2 w-fit"
          >
            <Icon name="lock" size={18} /> Lock now
          </button>
        </section>

        <p className="text-center text-xs text-secondary">
          ProxLink · v0.1.0
          {process.env.NEXT_PUBLIC_BUILD_TIME && (
            <> · Built {new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleString()}</>
          )}
        </p>
      </PageShell>
    </>
  );
}
