// ── PVE proxy allowlist (OWASP A01) ──────────────────────────────────────────
// The generic proxy never forwards arbitrary paths. Only (method, path) pairs
// matched here are permitted; everything else is rejected with 403.

interface Rule {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  pattern: RegExp;
}

const NODE = '[\\w.-]+';
const VMID = '\\d+';
const STORE = '[\\w.-]+';
const SNAP = '[\\w-]+';

const RULES: Rule[] = [
  // reads
  { method: 'GET', pattern: re('^/version$') },
  { method: 'GET', pattern: re('^/nodes$') },
  { method: 'GET', pattern: re('^/cluster/resources$') },
  { method: 'GET', pattern: re('^/cluster/nextid$') },
  { method: 'GET', pattern: re(`^/nodes/${NODE}/status$`) },
  { method: 'GET', pattern: re(`^/nodes/${NODE}/(qemu|lxc)/${VMID}/status/current$`) },
  { method: 'GET', pattern: re(`^/nodes/${NODE}/(qemu|lxc)/${VMID}/config$`) },
  { method: 'GET', pattern: re(`^/nodes/${NODE}/(qemu|lxc)/${VMID}/snapshot$`) },
  { method: 'GET', pattern: re(`^/nodes/${NODE}/storage$`) },
  { method: 'GET', pattern: re(`^/nodes/${NODE}/storage/${STORE}/content$`) },
  { method: 'GET', pattern: re(`^/nodes/${NODE}/tasks$`) },
  { method: 'GET', pattern: re(`^/nodes/${NODE}/tasks/[^/]+/status$`) },
  { method: 'GET', pattern: re(`^/nodes/${NODE}/tasks/[^/]+/log$`) },
  // lifecycle
  {
    method: 'POST',
    pattern: re(
      `^/nodes/${NODE}/(qemu|lxc)/${VMID}/status/(start|stop|shutdown|reboot|suspend|resume)$`,
    ),
  },
  // create / configure / delete
  { method: 'POST', pattern: re(`^/nodes/${NODE}/(qemu|lxc)$`) },
  { method: 'PUT', pattern: re(`^/nodes/${NODE}/(qemu|lxc)/${VMID}/config$`) },
  { method: 'DELETE', pattern: re(`^/nodes/${NODE}/(qemu|lxc)/${VMID}$`) },
  // snapshots
  { method: 'POST', pattern: re(`^/nodes/${NODE}/(qemu|lxc)/${VMID}/snapshot$`) },
  {
    method: 'POST',
    pattern: re(`^/nodes/${NODE}/(qemu|lxc)/${VMID}/snapshot/${SNAP}/rollback$`),
  },
  {
    method: 'DELETE',
    pattern: re(`^/nodes/${NODE}/(qemu|lxc)/${VMID}/snapshot/${SNAP}$`),
  },
  // iso / backups
  { method: 'POST', pattern: re(`^/nodes/${NODE}/storage/${STORE}/download-url$`) },
  { method: 'POST', pattern: re(`^/nodes/${NODE}/vzdump$`) },
];

function re(s: string): RegExp {
  return new RegExp(s);
}

export function isAllowed(method: string, path: string): boolean {
  return RULES.some((r) => r.method === method && r.pattern.test(path));
}
