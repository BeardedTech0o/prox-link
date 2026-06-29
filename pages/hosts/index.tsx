import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import AppBar from '@/components/AppBar';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/Icon';
import ConfirmDialog from '@/components/ConfirmDialog';
import { PageShell, CardSkeleton, ErrorState, EmptyState } from '@/components/ui';
import { useHosts, type PublicHost } from '@/lib/client/hooks';
import { api } from '@/lib/client/fetcher';

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
                className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Add a host
              </Link>
            }
          />
        )}
        <div className="flex flex-col gap-3">
          {hostsQ.data?.map((h) => (
            <div key={h.id} className="card flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-accent/[0.12] grid place-items-center">
                <Icon name="dns" className="text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{h.name}</div>
                <div className="text-xs text-secondary truncate">{h.baseUrl}</div>
                <div className="text-xs text-secondary truncate font-mono">{h.tokenId}</div>
              </div>
              <button
                aria-label={`Delete ${h.name}`}
                onClick={() => setToDelete(h)}
                className="px-2 py-1.5 rounded-xl text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
              >
                <Icon name="delete" size={20} />
              </button>
            </div>
          ))}
        </div>
      </PageShell>
      <BottomNav />

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
