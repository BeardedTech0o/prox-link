import { useQuery } from '@tanstack/react-query';
import AppBar from '@/components/AppBar';
import Icon from '@/components/Icon';
import { PageShell, CardSkeleton, ErrorState, EmptyState } from '@/components/ui';
import { api, pvePath } from '@/lib/client/fetcher';
import { useHosts } from '@/lib/client/hooks';

interface TaskRow {
  upid: string;
  type: string;
  status?: string;
  node: string;
  starttime: number;
  endtime?: number;
  user: string;
  hostName: string;
}

export default function TasksPage() {
  const hostsQ = useHosts();
  const tasksQ = useQuery({
    enabled: !!hostsQ.data,
    queryKey: ['tasks', hostsQ.data?.map((h) => h.id)],
    refetchInterval: 8_000,
    queryFn: async (): Promise<TaskRow[]> => {
      const rows: TaskRow[] = [];
      await Promise.all(
        (hostsQ.data || []).map(async (h) => {
          const nodes = await api<{ data: { node: string }[] }>(pvePath(h.id, '/nodes'));
          await Promise.all(
            (nodes.data || []).map(async (n) => {
              const t = await api<{ data: any[] }>(
                pvePath(h.id, `/nodes/${n.node}/tasks`, { limit: '30' }),
              );
              for (const row of t.data || []) rows.push({ ...row, hostName: h.name });
            }),
          );
        }),
      );
      return rows.sort((a, b) => b.starttime - a.starttime).slice(0, 80);
    },
  });

  return (
    <>
      <AppBar title="Tasks" subtitle="Recent activity across hosts" />
      <PageShell>
        {(hostsQ.isLoading || tasksQ.isLoading) && <CardSkeleton count={5} />}
        {tasksQ.isError && (
          <ErrorState message={(tasksQ.error as Error).message} onRetry={tasksQ.refetch} />
        )}
        {tasksQ.data?.length === 0 && <EmptyState icon="receipt_long" title="No recent tasks" />}
        <div className="flex flex-col gap-2">
          {tasksQ.data?.map((t) => {
            const ok = t.status === 'OK' || t.status === undefined;
            const running = !t.endtime;
            return (
              <div key={t.upid} className="card !p-3 flex items-center gap-3">
                <Icon
                  name={running ? 'progress_activity' : ok ? 'check_circle' : 'error'}
                  size={20}
                  className={`${running ? 'text-accent animate-[spin_1s_linear_infinite]' : ok ? 'text-success' : 'text-danger'}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.type}</div>
                  <div className="text-xs text-secondary truncate">
                    {t.hostName} · {t.node} · {t.user}
                  </div>
                </div>
                <div className="text-xs text-secondary">
                  {new Date(t.starttime * 1000).toLocaleTimeString()}
                </div>
              </div>
            );
          })}
        </div>
      </PageShell>
    </>
  );
}
