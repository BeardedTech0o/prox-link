import { probeTls, pveRequest, type PveHost } from './proxmox/client';
import { assertSafeUrl } from './ssrf';
import type { AddHostInput } from './validators';

export interface TestResult {
  version?: string;
  release?: string;
  fingerprint: string | null;
  tlsAuthorized: boolean;
}

/**
 * Validate the base URL (SSRF), capture a TLS fingerprint when pinning a
 * self-signed cert, and confirm the token works by hitting /version.
 */
export async function testHost(input: AddHostInput): Promise<TestResult> {
  // Homelab hosts live on private ranges, so allowPrivate is intentional here.
  assertSafeUrl(input.baseUrl, { allowPrivate: true, schemes: ['https:', 'http:'] });

  let fingerprint = input.tlsFingerprint ?? null;
  let tlsAuthorized = false;
  if (!input.verifyTls && !fingerprint) {
    const probe = await probeTls(input.baseUrl);
    fingerprint = probe.fingerprint256 || null;
    tlsAuthorized = probe.authorized;
  }

  const host: PveHost = {
    baseUrl: input.baseUrl,
    tokenId: input.tokenId,
    secret: input.secret,
    tlsFingerprint: fingerprint,
    verifyTls: input.verifyTls,
  };
  const ver = await pveRequest<{ version: string; release: string }>(host, '/version');
  return {
    version: ver.data?.version,
    release: ver.data?.release,
    fingerprint,
    tlsAuthorized,
  };
}
