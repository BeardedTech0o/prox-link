import { describe, it, expect } from 'vitest';
import { isAllowed } from './allowlist';

describe('PVE proxy allowlist (A01)', () => {
  it('permits known read + action paths', () => {
    expect(isAllowed('GET', '/cluster/resources')).toBe(true);
    expect(isAllowed('POST', '/nodes/pve1/qemu/100/status/start')).toBe(true);
    expect(isAllowed('PUT', '/nodes/pve1/lxc/200/config')).toBe(true);
    expect(isAllowed('DELETE', '/nodes/pve1/qemu/100')).toBe(true);
  });

  it('allows create at the collection path (no vmid)', () => {
    expect(isAllowed('POST', '/nodes/pve1/qemu')).toBe(true);
    expect(isAllowed('POST', '/nodes/pve1/lxc')).toBe(true);
  });

  it('rejects unlisted or mismatched method/path pairs', () => {
    expect(isAllowed('GET', '/access/users')).toBe(false);
    expect(isAllowed('POST', '/nodes/pve1/qemu/100')).toBe(false); // not a create path
    expect(isAllowed('DELETE', '/nodes/pve1')).toBe(false);
    expect(isAllowed('GET', '/nodes/pve1/qemu/100/status/start')).toBe(false);
    expect(isAllowed('POST', '/nodes/pve1/qemu/100/status/destroy')).toBe(false);
  });
});
