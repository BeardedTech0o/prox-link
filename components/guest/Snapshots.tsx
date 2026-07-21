import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '@/components/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Spinner } from '@/components/ui';
import { api, pvePath } from '@/lib/client/fetcher';
import type { GuestType } from '@/lib/proxmox/endpoints';

interface Snap {
  name: string;
  snaptime?: number;
  description?: string;
  parent?: string;
}

const inputCls =
  'w-full px-3 py-2 bg-surface rounded-xl border border-border text-sm outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent';

export default function Snapshots({
  hostId,
  node,
  type,
  vmid,
}: {
  hostId: string;
  node: string;
  type: GuestType;
  vmid: number;
}) {
  const qc = useQueryClient();
  const key = ['snapshots', hostId, type, vmid, node];
  const snapsQ = useQuery({
    queryKey: key,
    queryFn: () =>
      api<{ data: Snap[] }>(
        pvePath(hostId, `/nodes/${node}/${type}/${vmid}/snapshot`),
      ).then((r) => (r.data || []).filter((s) => s.name !== 'current')),
  });

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [rollback, setRollback] = useState<Snap | null>(null);
  const [del, setDel] = useState<Snap | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const create = useMutation({
    mutationFn: () =>
      api(pvePath(hostId, `/nodes/${node}/${type}/${vmid}/snapshot`), {
        method: 'POST',
        body: JSON.stringify({ snapname: name, description: desc || undefined }),
      }),
    onSuccess: () => {
      setCreating(false);
      setName('');
      setDesc('');
      invalidate();
    },
  });

  const doRollback = useMutation({
    mutationFn: (snap: string) =>
      api(pvePath(hostId, `/nodes/${node}/${type}/${vmid}/snapshot/${snap}/rollback`), {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      setRollback(null);
      qc.invalidateQueries({ queryKey: ['guest-status', hostId, type, vmid] });
    },
  });

  const doDelete = useMutation({
    mutationFn: (snap: string) =>
      api(pvePath(hostId, `/nodes/${node}/${type}/${vmid}/snapshot/${snap}`), {
        method: 'DELETE',
      }),
    onSuccess: () => {
      setDel(null);
      invalidate();
    },
  });

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Snapshots</h2>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="btn-ghost text-sm text-accent flex items-center gap-1"
          >
            <Icon name="add" size={18} /> New
          </button>
        )}
      </div>

      {creating && (
        <div className="flex flex-col gap-2 panel-elevated p-3">
          <input
            className={inputCls}
            placeholder="Snapshot name (e.g. before-upgrade)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className={inputCls}
            placeholder="Description (optional)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          {create.isError && (
            <p className="text-sm text-danger">{(create.error as Error).message}</p>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCreating(false)} className="btn-ghost text-sm text-secondary">
              Cancel
            </button>
            <button
              onClick={() => create.mutate()}
              disabled={!name || create.isPending}
              className="px-4 py-2 rounded-2xl bg-accent text-gray-950 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2"
            >
              {create.isPending && <Spinner size={16} />} Create
            </button>
          </div>
        </div>
      )}

      {snapsQ.isLoading && <div className="skeleton h-16 w-full" />}
      {snapsQ.data?.length === 0 && !creating && (
        <p className="text-sm text-secondary">No snapshots yet.</p>
      )}
      <div className="flex flex-col divide-y divide-border">
        {snapsQ.data?.map((s) => (
          <div key={s.name} className="flex items-center gap-2 py-2">
            <Icon name="history" size={18} className="text-secondary" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{s.name}</div>
              {s.snaptime && (
                <div className="text-xs text-secondary">
                  {new Date(s.snaptime * 1000).toLocaleString()}
                </div>
              )}
              {s.description && (
                <div className="text-xs text-secondary truncate">{s.description}</div>
              )}
            </div>
            <button
              aria-label={`Roll back to ${s.name}`}
              onClick={() => setRollback(s)}
              className="btn-ghost text-secondary hover:text-accent"
            >
              <Icon name="settings_backup_restore" size={20} />
            </button>
            <button
              aria-label={`Delete ${s.name}`}
              onClick={() => setDel(s)}
              className="px-2 py-1.5 rounded-full text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
            >
              <Icon name="delete" size={18} />
            </button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!rollback}
        danger
        title="Roll back"
        message={`Roll back to "${rollback?.name}"? Changes since this snapshot will be lost.`}
        confirmLabel="Roll back"
        busy={doRollback.isPending}
        onCancel={() => setRollback(null)}
        onConfirm={() => rollback && doRollback.mutate(rollback.name)}
      />
      <ConfirmDialog
        open={!!del}
        danger
        title="Delete snapshot"
        message={`Permanently delete snapshot "${del?.name}"?`}
        confirmLabel="Delete"
        busy={doDelete.isPending}
        onCancel={() => setDel(null)}
        onConfirm={() => del && doDelete.mutate(del.name)}
      />
    </section>
  );
}
