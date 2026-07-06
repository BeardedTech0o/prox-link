import { pveRequest, type PveHost } from './client';

// Typed-ish wrappers over the PVE API surface used by ProxLink. These keep the
// API routes thin and the endpoint strings in one place.

export type GuestType = 'qemu' | 'lxc';

export interface ClusterResource {
  id: string;
  type: string; // 'qemu' | 'lxc' | 'node' | 'storage' | ...
  node: string;
  vmid?: number;
  name?: string;
  status?: string;
  maxmem?: number;
  mem?: number;
  maxcpu?: number;
  cpu?: number;
  maxdisk?: number;
  disk?: number;
  uptime?: number;
  template?: number;
}

export const pve = {
  version: (h: PveHost) => pveRequest(h, '/version'),

  nodes: (h: PveHost) => pveRequest(h, '/nodes'),

  clusterResources: (h: PveHost, type?: string) =>
    pveRequest<ClusterResource[]>(h, '/cluster/resources', {
      query: type ? { type } : undefined,
    }),

  nodeStatus: (h: PveHost, node: string) => pveRequest(h, `/nodes/${node}/status`),

  // ── guest status / lifecycle ───────────────────────────────────────────────
  guestStatus: (h: PveHost, node: string, t: GuestType, vmid: number) =>
    pveRequest(h, `/nodes/${node}/${t}/${vmid}/status/current`),

  guestConfig: (h: PveHost, node: string, t: GuestType, vmid: number) =>
    pveRequest(h, `/nodes/${node}/${t}/${vmid}/config`),

  setGuestConfig: (
    h: PveHost,
    node: string,
    t: GuestType,
    vmid: number,
    body: Record<string, string | number | boolean | undefined>,
  ) => pveRequest(h, `/nodes/${node}/${t}/${vmid}/config`, { method: 'PUT', body }),

  guestAction: (
    h: PveHost,
    node: string,
    t: GuestType,
    vmid: number,
    action: 'start' | 'stop' | 'shutdown' | 'reboot' | 'suspend' | 'resume',
    body?: Record<string, string | number | boolean | undefined>,
  ) =>
    pveRequest(h, `/nodes/${node}/${t}/${vmid}/status/${action}`, {
      method: 'POST',
      body,
    }),

  createGuest: (
    h: PveHost,
    node: string,
    t: GuestType,
    body: Record<string, string | number | boolean | undefined>,
  ) => pveRequest(h, `/nodes/${node}/${t}`, { method: 'POST', body }),

  deleteGuest: (h: PveHost, node: string, t: GuestType, vmid: number) =>
    pveRequest(h, `/nodes/${node}/${t}/${vmid}`, { method: 'DELETE' }),

  // ── snapshots ───────────────────────────────────────────────────────────────
  snapshots: (h: PveHost, node: string, t: GuestType, vmid: number) =>
    pveRequest(h, `/nodes/${node}/${t}/${vmid}/snapshot`),

  createSnapshot: (
    h: PveHost,
    node: string,
    t: GuestType,
    vmid: number,
    body: Record<string, string | number | boolean | undefined>,
  ) => pveRequest(h, `/nodes/${node}/${t}/${vmid}/snapshot`, { method: 'POST', body }),

  rollbackSnapshot: (
    h: PveHost,
    node: string,
    t: GuestType,
    vmid: number,
    snap: string,
  ) =>
    pveRequest(h, `/nodes/${node}/${t}/${vmid}/snapshot/${snap}/rollback`, {
      method: 'POST',
    }),

  deleteSnapshot: (h: PveHost, node: string, t: GuestType, vmid: number, snap: string) =>
    pveRequest(h, `/nodes/${node}/${t}/${vmid}/snapshot/${snap}`, { method: 'DELETE' }),

  // ── storage / ISO / backups ─────────────────────────────────────────────────
  storage: (h: PveHost, node: string) => pveRequest(h, `/nodes/${node}/storage`),

  storageContent: (h: PveHost, node: string, storage: string, content?: string) =>
    pveRequest(h, `/nodes/${node}/storage/${storage}/content`, {
      query: content ? { content } : undefined,
    }),

  downloadUrl: (
    h: PveHost,
    node: string,
    storage: string,
    body: Record<string, string | number | boolean | undefined>,
  ) =>
    pveRequest(h, `/nodes/${node}/storage/${storage}/download-url`, {
      method: 'POST',
      body,
    }),

  vzdump: (
    h: PveHost,
    node: string,
    body: Record<string, string | number | boolean | undefined>,
  ) => pveRequest(h, `/nodes/${node}/vzdump`, { method: 'POST', body }),

  // ── tasks ───────────────────────────────────────────────────────────────────
  tasks: (h: PveHost, node: string, limit = 50) =>
    pveRequest(h, `/nodes/${node}/tasks`, { query: { limit } }),

  taskStatus: (h: PveHost, node: string, upid: string) =>
    pveRequest(h, `/nodes/${node}/tasks/${encodeURIComponent(upid)}/status`),

  // ── console ticketing ───────────────────────────────────────────────────────
  vncproxy: (h: PveHost, node: string, t: GuestType, vmid: number) =>
    pveRequest(h, `/nodes/${node}/${t}/${vmid}/vncproxy`, {
      method: 'POST',
      body: { websocket: 1 },
    }),

  termproxy: (h: PveHost, node: string, t: GuestType, vmid: number) =>
    pveRequest(h, `/nodes/${node}/${t}/${vmid}/termproxy`, { method: 'POST' }),

  // Shell on the node itself (not a guest) — Proxmox's "Datacenter > Node >
  // Shell". Always a terminal session; there's no VNC/framebuffer equivalent
  // for a bare node.
  nodeTermProxy: (h: PveHost, node: string) =>
    pveRequest(h, `/nodes/${node}/termproxy`, { method: 'POST' }),
};
