import { isIP } from 'node:net';

// ── SSRF guard (OWASP A10) ───────────────────────────────────────────────────
// Both the host base-URL field and the "download ISO from URL" feature accept a
// user-supplied URL that the server (or Proxmox) will fetch. We constrain the
// scheme and refuse obvious internal targets unless the operator opts in.
//
// Homelab note: Proxmox hosts usually live on RFC1918 ranges, so the *host base
// URL* legitimately points at private space — allowPrivate is enabled for that
// check. The *ISO download* URL defaults to public-only, overridable via
// PROXLINK_ALLOW_PRIVATE_ISO=1 for fully air-gapped setups.

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
]);

// Cloud metadata + obvious internal singletons that should never be fetched.
const BLOCKED_EXACT_IPS = new Set(['169.254.169.254', '100.100.100.200']);

export interface UrlGuardOptions {
  /** Permit RFC1918 / loopback / link-local targets (e.g. for the Proxmox host URL). */
  allowPrivate?: boolean;
  /** Allowed URL schemes. */
  schemes?: string[];
}

export class SsrfError extends Error {}

function ipv4ToParts(host: string): number[] | null {
  if (isIP(host) !== 4) return null;
  return host.split('.').map((p) => Number(p));
}

function isPrivateIpv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === '::1' || h === '::') return true;
  if (h.startsWith('fe80')) return true; // link-local
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // unique-local
  if (h.startsWith('::ffff:')) {
    const v4 = h.split(':').pop() ?? '';
    const parts = ipv4ToParts(v4);
    if (parts) return isPrivateIpv4(parts);
  }
  return false;
}

/**
 * Validate a user-supplied URL against SSRF. Returns the parsed URL on success.
 * NOTE: this is a string/literal-IP check; for server-side fetches that resolve
 * DNS, callers must additionally pin to the resolved address to avoid rebinding.
 */
export function assertSafeUrl(raw: string, opts: UrlGuardOptions = {}): URL {
  const schemes = opts.schemes ?? ['http:', 'https:'];
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError('Invalid URL');
  }
  if (!schemes.includes(url.protocol)) {
    throw new SsrfError(`Scheme not allowed: ${url.protocol}`);
  }
  const host = url.hostname.toLowerCase();
  // WHATWG URL keeps IPv6 hosts bracketed (e.g. "[fd00::1]"); strip for IP checks.
  const ipHost = host.replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new SsrfError('Host is not allowed');
  }

  const v4 = ipv4ToParts(ipHost);
  const ipKind = isIP(ipHost);
  if (ipKind !== 0 && (BLOCKED_EXACT_IPS.has(ipHost) || ipHost === '::')) {
    throw new SsrfError('Address is not allowed');
  }

  if (!opts.allowPrivate) {
    if (v4 && isPrivateIpv4(v4)) throw new SsrfError('Private address blocked');
    if (ipKind === 6 && isPrivateIpv6(ipHost)) {
      throw new SsrfError('Private address blocked');
    }
    // A literal-IP requirement isn't imposed on public hostnames, but the most
    // common SSRF singletons resolve to link-local — those are caught above.
  }
  return url;
}

export function isoDownloadAllowsPrivate(): boolean {
  return process.env.PROXLINK_ALLOW_PRIVATE_ISO === '1';
}
