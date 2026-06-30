import { useQuery } from '@tanstack/react-query';
import { api, pvePath } from './fetcher';
import type { ClusterResource } from '@/lib/proxmox/endpoints';

export interface PublicHost {
  id: string;
  name: string;
  baseUrl: string;
  tokenId: string;
  tlsFingerprint: string | null;
  verifyTls: boolean;
  createdAt: number;
}

export function useHosts() {
  return useQuery({
    queryKey: ['hosts'],
    queryFn: () => api<{ hosts: PublicHost[] }>('/api/hosts').then((r) => r.hosts),
  });
}

export interface GuestRow extends ClusterResource {
  hostId: string;
  hostName: string;
}

/** Aggregate guests (qemu+lxc) across every configured host. */
export function useAllGuests(hosts: PublicHost[] | undefined) {
  return useQuery({
    enabled: !!hosts,
    queryKey: ['guests', hosts?.map((h) => h.id)],
    refetchInterval: 10_000,
    queryFn: async (): Promise<{ guests: GuestRow[]; errors: string[] }> => {
      const guests: GuestRow[] = [];
      const errors: string[] = [];
      await Promise.all(
        (hosts || []).map(async (h) => {
          try {
            const r = await api<{ data: ClusterResource[] }>(
              pvePath(h.id, '/cluster/resources', { type: 'vm' }),
            );
            for (const res of r.data || []) {
              if (res.type === 'qemu' || res.type === 'lxc') {
                guests.push({ ...res, hostId: h.id, hostName: h.name });
              }
            }
          } catch (e) {
            errors.push(`${h.name}: ${(e as Error).message}`);
          }
        }),
      );
      guests.sort((a, b) => (a.vmid ?? 0) - (b.vmid ?? 0));
      return { guests, errors };
    },
  });
}
