import { describe, it, expect } from 'vitest';
import type { NextApiRequest } from 'next';
import { isHttps } from './session';

function fakeReq(opts: { proto?: string | string[]; encrypted?: boolean }): NextApiRequest {
  return {
    headers: opts.proto ? { 'x-forwarded-proto': opts.proto } : {},
    socket: { encrypted: opts.encrypted ?? false } as any,
  } as unknown as NextApiRequest;
}

describe('isHttps (session cookie Secure flag)', () => {
  it('is false for a plain HTTP request with no proxy headers', () => {
    expect(isHttps(fakeReq({}))).toBe(false);
  });

  it('is true when the socket itself is TLS-encrypted', () => {
    expect(isHttps(fakeReq({ encrypted: true }))).toBe(true);
  });

  it('is true when x-forwarded-proto says https (reverse proxy)', () => {
    expect(isHttps(fakeReq({ proto: 'https' }))).toBe(true);
  });

  it('is false when x-forwarded-proto says http, even if later comma-values differ', () => {
    expect(isHttps(fakeReq({ proto: 'http, https' }))).toBe(false);
  });

  it('handles x-forwarded-proto being an array (some proxies send this)', () => {
    expect(isHttps(fakeReq({ proto: ['https', 'http'] }))).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isHttps(fakeReq({ proto: 'HTTPS' }))).toBe(true);
  });
});
