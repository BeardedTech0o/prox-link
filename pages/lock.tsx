import { useRouter } from 'next/router';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '@/components/Icon';
import { Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/client/fetcher';

interface LockStatus {
  configured: boolean;
  unlocked: boolean;
  lockedForMs: number;
}

export default function LockPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['lock-status'],
    queryFn: () => api<LockStatus>('/api/lock/status'),
  });
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isSetup = data ? !data.configured : false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (isSetup && pin !== confirm) {
      setError('PINs do not match');
      return;
    }
    setBusy(true);
    try {
      await api(isSetup ? '/api/lock/setup' : '/api/lock/unlock', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });
      await qc.invalidateQueries({ queryKey: ['lock-status'] });
      const next = typeof router.query.next === 'string' ? router.query.next : '/';
      router.replace(next);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Something went wrong';
      setError(msg);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-5">
      <form
        onSubmit={submit}
        className="card w-full max-w-sm flex flex-col gap-4 animate-fade-in"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="h-14 w-14 rounded-2xl bg-accent/[0.12] grid place-items-center">
            <Icon name={isSetup ? 'lock_open' : 'lock'} size={30} className="text-accent" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isSetup ? 'Set up ProxLink' : 'Unlock ProxLink'}
          </h1>
          <p className="text-sm text-secondary">
            {isSetup
              ? 'Choose a PIN or passphrase. It encrypts your stored Proxmox tokens — there is no recovery if you forget it.'
              : 'Enter your PIN to decrypt your hosts.'}
          </p>
        </div>

        <input
          type="password"
          inputMode="numeric"
          autoFocus
          autoComplete={isSetup ? 'new-password' : 'current-password'}
          placeholder="PIN or passphrase"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full px-3 py-2.5 bg-surface rounded-xl border border-border text-sm outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent transition-colors"
        />
        {isSetup && (
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm PIN"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-3 py-2.5 bg-surface rounded-xl border border-border text-sm outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent transition-colors"
          />
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        {data && data.lockedForMs > 0 && (
          <p className="text-sm text-warning">
            Locked for {Math.ceil(data.lockedForMs / 1000)}s after failed attempts.
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !pin || (data?.lockedForMs ?? 0) > 0}
          className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {busy && <Spinner size={16} />}
          {isSetup ? 'Create & continue' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
