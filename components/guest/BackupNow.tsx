import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '@/components/Icon';
import { Spinner } from '@/components/ui';
import { api, pvePath } from '@/lib/client/fetcher';

interface StorageRow {
  storage: string;
  content: string;
  type: string;
}
interface BackupRow {
  volid: string;
  ctime: number;
  size: number;
  vmid?: number;
}

function fmtSize(b?: number) {
  if (!b) return '—';
  const gb = b / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(b / 1024 ** 2).toFixed(0)} MB`;
}

const selectCls =
  'px-3 py-2 bg-surface rounded-xl border border-border text-sm outline-none focus:ring-2 focus:ring-accent/50';

export default function BackupNow({
  hostId,
  node,
  vmid,
}: {
  hostId: string;
  node: string;
  vmid: number;
}) {
  const qc = useQueryClient();
  const [storage, setStorage] = useState('');
  const [mode, setMode] = useState('snapshot');
  const [open, setOpen] = useState(false);

  const storagesQ = useQuery({
    queryKey: ['storages-backup', hostId, node],
    queryFn: () =>
      api<{ data: StorageRow[] }>(pvePath(hostId, `/nodes/${node}/storage`)).then((r) =>
        (r.data || []).filter((s) => (s.content || '').includes('backup')),
      ),
  });

  useEffect(() => {
    if (!storage && storagesQ.data && storagesQ.data.length > 0) {
      setStorage(storagesQ.data[0].storage);
    }
  }, [storagesQ.data, storage]);

  const backupsQ = useQuery({
    enabled: !!storage,
    queryKey: ['backups', hostId, node, storage, vmid],
    queryFn: () =>
      api<{ data: BackupRow[] }>(
        pvePath(hostId, `/nodes/${node}/storage/${storage}/content`, { content: 'backup' }),
      ).then((r) => (r.data || []).filter((b) => b.vmid === vmid)),
  });

  const run = useMutation({
    mutationFn: () =>
      api(pvePath(hostId, `/nodes/${node}/vzdump`), {
        method: 'POST',
        body: JSON.stringify({ vmid, storage, mode, compress: 'zstd' }),
      }),
    onSuccess: () => {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['backups', hostId, node, storage, vmid] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const noStorage = storagesQ.data?.length === 0;

  return (
    <section className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Backups</h2>
        {!open && !noStorage && (
          <button
            onClick={() => setOpen(true)}
            className="btn-ghost text-sm text-accent flex items-center gap-1"
          >
            <Icon name="backup" size={18} /> Backup now
          </button>
        )}
      </div>

      {noStorage && (
        <p className="text-sm text-secondary">No backup-capable storage on this node.</p>
      )}

      {open && (
        <div className="flex flex-col gap-2 panel-elevated p-3">
          <div className="flex flex-wrap gap-2">
            <select className={selectCls} value={storage} onChange={(e) => setStorage(e.target.value)}>
              {storagesQ.data?.map((s) => (
                <option key={s.storage} value={s.storage}>
                  {s.storage}
                </option>
              ))}
            </select>
            <select className={selectCls} value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="snapshot">snapshot</option>
              <option value="suspend">suspend</option>
              <option value="stop">stop</option>
            </select>
          </div>
          {run.isError && <p className="text-sm text-danger">{(run.error as Error).message}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setOpen(false)} className="btn-ghost text-sm text-secondary">
              Cancel
            </button>
            <button
              onClick={() => run.mutate()}
              disabled={!storage || run.isPending}
              className="px-4 py-2 rounded-2xl bg-accent text-gray-950 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2"
            >
              {run.isPending && <Spinner size={16} />} Start backup
            </button>
          </div>
        </div>
      )}

      {backupsQ.data && backupsQ.data.length > 0 && (
        <div className="flex flex-col divide-y divide-border">
          {backupsQ.data
            .sort((a, b) => b.ctime - a.ctime)
            .map((b) => (
              <div key={b.volid} className="flex items-center gap-2 py-2">
                <Icon name="archive" size={18} className="text-secondary" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">
                    {new Date(b.ctime * 1000).toLocaleString()}
                  </div>
                  <div className="text-xs text-secondary truncate">{b.volid}</div>
                </div>
                <span className="text-xs text-secondary">{fmtSize(b.size)}</span>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
