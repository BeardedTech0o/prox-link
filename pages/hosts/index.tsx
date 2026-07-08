import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AppBar from '@/components/AppBar';
import Icon from '@/components/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { PageShell, CardSkeleton, ErrorState, EmptyState } from '@/components/ui';
import { useHosts, type PublicHost } from '@/lib/client/hooks';
import { api, pvePath } from '@/lib/client/fetcher';

function HostRow({ h, onDelete }: { h: PublicHost; onDelete: (h: PublicHost) => void }) {
  const router = useRouter();
  const [showNodes, setShowNodes] = useState(false);

  const nodesQ = useQuery({
    queryKey: ['nodes', h.id],
    queryFn: () =>
      api<{ data: { node: string }[] }>(pvePath(h.id, '/nodes')).then((r) => r.data || []),
  });

  function openConsole() {
    // Most homelab setups are single-node, so skip the picker entirely when
    // there's only one to choose from.
    if (nodesQ.data && nodesQ.data.length === 1) {
      router.push(`/console/${h.id}/node/${nodesQ.data[0].node}`);
      return;
    }
    setShowNodes((v) => !v);
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-accent/[0.12] grid place-items-center">
          <Icon name="dns" className="text-accent" />
        </div>
        <div className="min-w-0 overflow-hidden">
          <div className="font-semibold truncate">{h.name}</div>
          <div className="text-xs text-secondary truncate">{h.baseUrl}</div>
          <div className="text-xs text-secondary truncate font-mono">{h.tokenId}</div>
        </div>
        <button
          aria-label={`Open shell on ${h.name}`}
          onClick={openConsole}
          className="px-2 py-1.5 rounded-xl text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
        >
          <Icon name="terminal" size={20} />
        </button>
        <button
          aria-label={`Delete ${h.name}`}
          onClick={() => onDelete(h)}
          className="px-2 py-1.5 rounded-xl text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
        >
          <Icon name="delete" size={20} />
        </button>
      </div>

      {showNodes && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          {nodesQ.isLoading && <p className="text-xs text-secondary">Loading nodes…</p>}
          {nodesQ.isError && (
            <p className="text-xs text-danger">{(nodesQ.error as Error).message}</p>
          )}
          {nodesQ.data?.map((n) => (
            <Link
              key={n.node}
              href={`/console/${h.id}/node/${n.node}`}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-elevated text-sm font-medium hover:bg-border/40 transition-colors"
            >
              <Icon name="terminal" size={18} className="text-accent" />
              {n.node}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HostsPage() {
  const hostsQ = useHosts();
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<PublicHost | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => api(`/api/hosts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hosts'] });
      qc.invalidateQueries({ queryKey: ['guests'] });
      setToDelete(null);
    },
  });

  return (
    <>
      <AppBar
        title="Hosts"
        actions={
          <Link href="/hosts/new" aria-label="Add host" className="btn-ghost text-accent flex items-center">
            <Icon name="add" size={24} />
          </Link>
        }
      />
      <PageShell>
        {hostsQ.isLoading && <CardSkeleton />}
        {hostsQ.isError && (
          <ErrorState message={(hostsQ.error as Error).message} onRetry={hostsQ.refetch} />
        )}
        {hostsQ.data?.length === 0 && (
          <EmptyState
            icon="dns"
            title="No hosts"
            subtitle="Add a Proxmox host using an API token."
            action={
              <Link
                href="/hosts/new"
                className="px-4 py-2 rounded-2xl bg-accent text-gray-950 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Add a host
              </Link>
            }
          />
        )}
        <div className="flex flex-col gap-3">
          {hostsQ.data?.map((h) => (
            <HostRow key={h.id} h={h} onDelete={setToDelete} />
          ))}
        </div>
      </PageShell>

      <ConfirmDialog
        open={!!toDelete}
        danger
        title="Remove host"
        message={`Remove "${toDelete?.name}"? Its stored token will be deleted. VMs and containers are not affected.`}
        confirmLabel="Remove"
        busy={del.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
      />
    </>
  );
}
