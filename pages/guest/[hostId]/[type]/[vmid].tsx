import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AppBar from '@/components/AppBar';
import Icon from '@/components/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import Snapshots from '@/components/guest/Snapshots';
import BackupNow from '@/components/guest/BackupNow';
import { PageShell, CardSkeleton, ErrorState, StatusBadge, Spinner } from '@/components/ui';
import { api, pvePath, ApiError } from '@/lib/client/fetcher';
import { fieldGroups, fieldEnum } from '@/lib/proxmox/configFields';
import type { GuestType } from '@/lib/proxmox/endpoints';

interface GuestStatus {
  status?: string;
  name?: string;
  node?: string;
  vmid?: number;
  maxmem?: number;
  mem?: number;
  cpus?: number;
  cpu?: number;
  uptime?: number;
}

function fmtBytes(b?: number) {
  if (!b) return '—';
  const gb = b / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(b / 1024 ** 2).toFixed(0)} MB`;
}
function fmtUptime(s?: number) {
  if (!s) return '—';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const ACTIONS: Array<{
  key: 'start' | 'shutdown' | 'stop' | 'reboot';
  label: string;
  icon: string;
  danger?: boolean;
  confirm?: string;
}> = [
  { key: 'start', label: 'Start', icon: 'play_arrow' },
  { key: 'shutdown', label: 'Shutdown', icon: 'power_settings_new' },
  { key: 'reboot', label: 'Reboot', icon: 'restart_alt' },
  { key: 'stop', label: 'Stop', icon: 'stop', danger: true, confirm: 'Force-stop is like pulling the power. Continue?' },
];

export default function GuestDetail() {
  const router = useRouter();
  const qc = useQueryClient();
  const hostId = String(router.query.hostId || '');
  const type = String(router.query.type || 'qemu') as GuestType;
  const vmid = Number(router.query.vmid || 0);
  const ready = !!hostId && !!vmid;

  const base = `/nodes/__node__/${type}/${vmid}`;
  const statusQ = useQuery({
    enabled: ready,
    queryKey: ['guest-status', hostId, type, vmid],
    refetchInterval: 5_000,
    queryFn: async () => {
      // resolve node from cluster resources (refresh-safe deep link)
      const cr = await api<{ data: any[] }>(pvePath(hostId, '/cluster/resources', { type: 'vm' }));
      const found = cr.data.find((r) => r.vmid === vmid && (r.type === type));
      if (!found) throw new Error('Guest not found on this host');
      const st = await api<{ data: GuestStatus }>(
        pvePath(hostId, `/nodes/${found.node}/${type}/${vmid}/status/current`),
      );
      return { node: found.node as string, status: { ...st.data, node: found.node } };
    },
  });

  const node = statusQ.data?.node;

  const configQ = useQuery({
    enabled: ready && !!node,
    queryKey: ['guest-config', hostId, type, vmid, node],
    queryFn: () =>
      api<{ data: Record<string, any> }>(
        pvePath(hostId, `/nodes/${node}/${type}/${vmid}/config`),
      ).then((r) => r.data),
  });

  const [pending, setPending] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<(typeof ACTIONS)[number] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [newFieldKey, setNewFieldKey] = useState('');
  const [customField, setCustomField] = useState(false);

  const saveConfig = useMutation({
    mutationFn: () => {
      if (!node) throw new Error('Node unknown');
      // Only send fields that actually changed (or are brand new), not every
      // field the guest happens to have. Re-sending every field verbatim
      // (including ones the user never touched) risks a stricter PUT-time
      // validator rejecting some untouched value, breaking the whole save
      // over a field the user didn't even mean to edit.
      const changed: Record<string, string> = {};
      for (const [k, v] of Object.entries(edits)) {
        if (original[k] !== v) changed[k] = v;
      }
      return api(pvePath(hostId, `/nodes/${node}/${type}/${vmid}/config`), {
        method: 'PUT',
        body: JSON.stringify(changed),
      });
    },
    onSuccess: () => {
      setEditing(false);
      setEdits({});
      setOriginal({});
      setNewFieldKey('');
      setCustomField(false);
      qc.invalidateQueries({ queryKey: ['guest-config', hostId, type, vmid] });
    },
  });

  const act = useMutation({
    mutationFn: async (action: string) => {
      if (!node) throw new Error('Node unknown');
      return api(pvePath(hostId, `/nodes/${node}/${type}/${vmid}/status/${action}`), {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    onMutate: (action) => setPending(action),
    onSettled: () => {
      setPending(null);
      setConfirmAction(null);
      qc.invalidateQueries({ queryKey: ['guest-status', hostId, type, vmid] });
      qc.invalidateQueries({ queryKey: ['guests'] });
    },
  });

  const del = useMutation({
    mutationFn: () => {
      if (!node) throw new Error('Node unknown');
      return api(pvePath(hostId, `/nodes/${node}/${type}/${vmid}`), { method: 'DELETE' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      router.replace('/');
    },
  });

  const s = statusQ.data?.status;
  const title = s?.name || `Guest #${vmid}`;

  return (
    <>
      <AppBar
        title={title}
        subtitle={ready ? `${type.toUpperCase()} · #${vmid}` : undefined}
        back="/"
        actions={
          node ? (
            <Link
              href={`/console/${hostId}/${type}/${vmid}`}
              aria-label="Open console"
              className="btn-ghost text-secondary hover:text-accent flex items-center"
            >
              <Icon name="terminal" size={22} />
            </Link>
          ) : undefined
        }
      />
      <PageShell>
        {statusQ.isLoading && <CardSkeleton count={2} />}
        {statusQ.isError && (
          <ErrorState message={(statusQ.error as Error).message} onRetry={statusQ.refetch} />
        )}

        {s && (
          <>
            <div className="card flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-accent/[0.12] grid place-items-center">
                    <Icon name={type === 'lxc' ? 'deployed_code' : 'computer'} className="text-accent" />
                  </div>
                  <div>
                    <div className="font-semibold">{s.node}</div>
                    <div className="text-xs text-secondary">CPU {((s.cpu ?? 0) * 100).toFixed(0)}%</div>
                  </div>
                </div>
                <StatusBadge status={s.status} />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <Stat label="Memory" value={`${fmtBytes(s.mem)} / ${fmtBytes(s.maxmem)}`} />
                <Stat label="vCPUs" value={String(s.cpus ?? '—')} />
                <Stat label="Uptime" value={fmtUptime(s.uptime)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {ACTIONS.map((a) => (
                <button
                  key={a.key}
                  disabled={!!pending}
                  onClick={() => (a.confirm ? setConfirmAction(a) : act.mutate(a.key))}
                  className={`card !p-3 flex items-center justify-center gap-2 text-sm font-medium transition-shadow hover:shadow-card-hover disabled:opacity-50 ${
                    a.danger ? 'text-danger' : ''
                  }`}
                >
                  {pending === a.key ? <Spinner size={18} /> : <Icon name={a.icon} size={20} />}
                  {a.label}
                </button>
              ))}
            </div>

            <Link
              href={`/console/${hostId}/${type}/${vmid}`}
              className="card !p-3 flex items-center justify-center gap-2 text-sm font-medium text-accent hover:shadow-card-hover transition-shadow"
            >
              <Icon name="terminal" size={20} /> Open console
            </Link>

            <section className="card flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Configuration</h2>
                {configQ.data && !editing && (
                  <button
                    onClick={() => {
                      const seed: Record<string, string> = {};
                      for (const [k, v] of Object.entries(configQ.data!)) {
                        if (k === 'digest') continue;
                        seed[k] = String(v ?? '');
                      }
                      setEdits(seed);
                      setOriginal(seed);
                      setNewFieldKey('');
                      setCustomField(false);
                      setEditing(true);
                    }}
                    className="btn-ghost text-sm text-accent flex items-center gap-1"
                  >
                    <Icon name="edit" size={18} /> Edit
                  </button>
                )}
              </div>
              {configQ.isLoading && <div className="skeleton h-24 w-full" />}

              {configQ.data && !editing && (
                <div className="flex flex-col divide-y divide-border text-sm">
                  {Object.entries(configQ.data)
                    .filter(([k]) => k !== 'digest')
                    .map(([k, v]) => (
                      <div key={k} className="flex gap-3 py-1.5">
                        <span className="w-28 shrink-0 text-secondary font-mono text-xs">{k}</span>
                        <span className="font-mono text-xs break-all">{String(v)}</span>
                      </div>
                    ))}
                </div>
              )}

              {editing && (
                <div className="flex flex-col gap-3">
                  {Object.keys(edits).sort().map((k) => (
                    <div key={k} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-secondary font-mono">{k}</label>
                        <button
                          type="button"
                          aria-label={`Remove ${k}`}
                          onClick={() =>
                            setEdits((p) => {
                              const next = { ...p };
                              delete next[k];
                              return next;
                            })
                          }
                          className="text-secondary hover:text-danger"
                        >
                          <Icon name="close" size={16} />
                        </button>
                      </div>
                      {(() => {
                        const options = fieldEnum(type, k);
                        if (!options) {
                          return (
                            <input
                              className="w-full px-3 py-2 bg-surface rounded-xl border border-border text-sm font-mono outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent"
                              value={edits[k] ?? ''}
                              onChange={(e) => setEdits((p) => ({ ...p, [k]: e.target.value }))}
                            />
                          );
                        }
                        const current = edits[k] ?? '';
                        // Keep an unrecognised existing value selectable/visible
                        // rather than silently hiding or clobbering it.
                        const withCurrent = current && !options.includes(current) ? [current, ...options] : options;
                        return (
                          <select
                            className="w-full px-3 py-2 bg-surface rounded-xl border border-border text-sm font-mono outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent"
                            value={current}
                            onChange={(e) => setEdits((p) => ({ ...p, [k]: e.target.value }))}
                          >
                            {withCurrent.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>
                  ))}

                  {!customField ? (
                    <select
                      value=""
                      onChange={(e) => {
                        const key = e.target.value;
                        if (!key) return;
                        if (key === '__custom__') {
                          setCustomField(true);
                          return;
                        }
                        setEdits((p) => ({ ...p, [key]: '' }));
                      }}
                      className="w-full px-3 py-2 bg-surface rounded-xl border border-border text-sm outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent"
                    >
                      <option value="">+ Add a field…</option>
                      {fieldGroups(type).map((g) => {
                        const opts = g.fields.filter((f) => !(f in edits));
                        if (!opts.length) return null;
                        return (
                          <optgroup key={g.label} label={g.label}>
                            {opts.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                      <option value="__custom__">Custom field…</option>
                    </select>
                  ) : (
                    <div className="flex gap-2 pt-1">
                      <input
                        autoFocus
                        placeholder="Field name"
                        className="flex-1 px-3 py-2 bg-surface rounded-xl border border-border text-sm font-mono outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent"
                        value={newFieldKey}
                        onChange={(e) => setNewFieldKey(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const key = newFieldKey.trim();
                          if (!key || key in edits) return;
                          setEdits((p) => ({ ...p, [key]: '' }));
                          setNewFieldKey('');
                          setCustomField(false);
                        }}
                        className="btn-ghost text-sm text-accent flex items-center gap-1"
                      >
                        <Icon name="add" size={18} /> Add
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCustomField(false); setNewFieldKey(''); }}
                        className="btn-ghost text-sm text-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {saveConfig.isError && (
                    <div className="text-sm text-danger flex flex-col gap-0.5">
                      <p>{(saveConfig.error as ApiError).message}</p>
                      {(saveConfig.error as ApiError).fieldErrors &&
                        Object.entries((saveConfig.error as ApiError).fieldErrors!).map(([k, msg]) => (
                          <p key={k} className="font-mono text-xs">
                            {k}: {msg}
                          </p>
                        ))}
                    </div>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setEditing(false);
                        setEdits({});
                        setOriginal({});
                        setNewFieldKey('');
                        setCustomField(false);
                      }}
                      className="btn-ghost text-sm text-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveConfig.mutate()}
                      disabled={saveConfig.isPending}
                      className="px-4 py-2 rounded-2xl bg-accent text-gray-950 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2"
                    >
                      {saveConfig.isPending && <Spinner size={16} />} Save
                    </button>
                  </div>
                </div>
              )}
            </section>

            {node && <Snapshots hostId={hostId} node={node} type={type} vmid={vmid} />}
            {node && <BackupNow hostId={hostId} node={node} vmid={vmid} />}

            <button
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-2 rounded-xl text-sm text-secondary hover:text-danger hover:bg-danger/10 transition-colors flex items-center gap-2 w-fit"
            >
              <Icon name="delete" size={18} /> Delete guest
            </button>
          </>
        )}
      </PageShell>

      <ConfirmDialog
        open={!!confirmAction}
        danger={confirmAction?.danger}
        title={confirmAction?.label ?? ''}
        message={confirmAction?.confirm ?? ''}
        confirmLabel={confirmAction?.label}
        busy={!!pending}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => confirmAction && act.mutate(confirmAction.key)}
      />
      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Delete guest"
        message={`This permanently deletes ${title} (#${vmid}) and its disks. This cannot be undone.`}
        confirmLabel="Delete"
        typeToConfirm={String(vmid)}
        busy={del.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => del.mutate()}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-elevated p-3">
      <div className="stat-label">{label}</div>
      <div className="text-sm font-semibold mt-1 break-words">{value}</div>
    </div>
  );
}
