import { useRouter } from 'next/router';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import AppBar from '@/components/AppBar';
import Icon from '@/components/Icon';
import { PageShell, Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/client/fetcher';

interface FormState {
  name: string;
  baseUrl: string;
  tokenId: string;
  secret: string;
  verifyTls: boolean;
}

const inputCls =
  'w-full px-3 py-2.5 bg-surface rounded-xl border border-border text-sm outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent transition-colors';

export default function NewHostPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>({
    name: '',
    baseUrl: 'https://',
    tokenId: '',
    secret: '',
    verifyTls: false,
  });
  const [tested, setTested] = useState<string | null>(null);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setTested(null);
    setForm((f) => ({ ...f, [k]: v }));
  }

  const test = useMutation({
    mutationFn: () =>
      api<{ version: string }>('/api/hosts/test', {
        method: 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: (r) => setTested(`Connected — Proxmox VE ${r.version}`),
  });

  const save = useMutation({
    mutationFn: () =>
      api('/api/hosts', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hosts'] });
      qc.invalidateQueries({ queryKey: ['guests'] });
      router.push('/hosts');
    },
  });

  const err = (test.error || save.error) as ApiError | null;

  return (
    <>
      <AppBar title="Add host" back="/hosts" />
      <PageShell>
        <div className="card flex flex-col gap-4">
          <Field label="Display name">
            <input
              className={inputCls}
              placeholder="Home cluster"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </Field>
          <Field label="Base URL" hint="Include the port, e.g. https://192.168.1.10:8006">
            <input
              className={inputCls}
              inputMode="url"
              autoCapitalize="none"
              placeholder="https://192.168.1.10:8006"
              value={form.baseUrl}
              onChange={(e) => set('baseUrl', e.target.value)}
            />
          </Field>
          <Field label="API token ID" hint="Datacenter → Permissions → API Tokens">
            <input
              className={`${inputCls} font-mono`}
              autoCapitalize="none"
              placeholder="root@pam!proxlink"
              value={form.tokenId}
              onChange={(e) => set('tokenId', e.target.value)}
            />
          </Field>
          <Field label="API token secret">
            <input
              className={`${inputCls} font-mono`}
              type="password"
              autoComplete="off"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={form.secret}
              onChange={(e) => set('secret', e.target.value)}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.verifyTls}
              onChange={(e) => set('verifyTls', e.target.checked)}
            />
            Verify TLS against system CAs
            <span className="text-xs text-secondary">
              (off = pin the self-signed cert on first connect)
            </span>
          </label>

          {tested && (
            <div className="flex items-center gap-2 text-sm text-success">
              <Icon name="check_circle" size={18} /> {tested}
            </div>
          )}
          {err && (
            <div className="flex items-center gap-2 text-sm text-danger">
              <Icon name="error" size={18} /> {err.message}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => test.mutate()}
              disabled={test.isPending || !form.baseUrl || !form.tokenId || !form.secret}
              className="btn-ghost border border-border text-sm flex items-center gap-2 disabled:opacity-40"
            >
              {test.isPending ? <Spinner size={16} /> : <Icon name="wifi_tethering" size={18} />}
              Test connection
            </button>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.name || !form.baseUrl || !form.tokenId || !form.secret}
              className="px-4 py-2 rounded-2xl bg-accent text-gray-950 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2 ml-auto"
            >
              {save.isPending && <Spinner size={16} />}
              Save host
            </button>
          </div>
        </div>
      </PageShell>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-secondary">{hint}</p>}
    </div>
  );
}
