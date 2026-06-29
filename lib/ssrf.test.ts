import { describe, it, expect } from 'vitest';
import { assertSafeUrl, SsrfError } from './ssrf';

describe('SSRF guard', () => {
  it('allows public https URLs', () => {
    expect(() => assertSafeUrl('https://download.proxmox.com/iso/x.iso')).not.toThrow();
  });

  it('blocks non-http(s) schemes', () => {
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow(SsrfError);
    expect(() => assertSafeUrl('gopher://x')).toThrow(SsrfError);
  });

  it('blocks loopback and link-local by default', () => {
    expect(() => assertSafeUrl('http://127.0.0.1/')).toThrow(SsrfError);
    expect(() => assertSafeUrl('http://localhost/')).toThrow(SsrfError);
    expect(() => assertSafeUrl('http://169.254.169.254/latest/meta-data')).toThrow(
      SsrfError,
    );
  });

  it('blocks RFC1918 ranges by default', () => {
    expect(() => assertSafeUrl('http://10.0.0.5/')).toThrow(SsrfError);
    expect(() => assertSafeUrl('http://192.168.1.10:8006/')).toThrow(SsrfError);
    expect(() => assertSafeUrl('http://172.16.0.1/')).toThrow(SsrfError);
  });

  it('permits private targets when allowPrivate is set (host URL case)', () => {
    expect(() =>
      assertSafeUrl('https://192.168.1.10:8006', { allowPrivate: true }),
    ).not.toThrow();
  });

  it('blocks IPv6 loopback / unique-local by default', () => {
    expect(() => assertSafeUrl('http://[::1]/')).toThrow(SsrfError);
    expect(() => assertSafeUrl('http://[fd00::1]/')).toThrow(SsrfError);
  });
});
