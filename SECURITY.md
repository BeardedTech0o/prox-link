# Security Model

ProxLink holds API tokens that control your Proxmox infrastructure, so security
is treated as a first-class concern mapped to the OWASP Top 10.

## Threat model summary
- **Assets:** Proxmox API token secrets, the app-unlock PIN-derived key, console
  tickets.
- **Trust boundary:** the self-hosted ProxLink server is the only component that
  ever sees decrypted token secrets. The browser talks only to ProxLink's
  same-origin BFF.

## Controls (OWASP Top 10)
- **A01 Broken Access Control** — every API route requires a valid app-unlock
  session. The PVE proxy (`pages/api/pve/[...path].ts`) only forwards
  `(method, path)` pairs on an explicit allowlist (`lib/proxmox/allowlist.ts`);
  arbitrary passthrough is impossible.
- **A02 Cryptographic Failures** — token secrets are encrypted at rest with
  AES-256-GCM. The data-encryption key (DEK) is wrapped by a key derived from the
  PIN via scrypt and only ever exists decrypted in server memory while unlocked
  (`lib/crypto.ts`, `lib/session.ts`).
- **A03 Injection** — all request bodies are validated with zod; SQLite access is
  fully parameterized (`lib/db.ts`).
- **A04 Insecure Design** — single-use, short-lived console tickets; PIN attempts
  are rate-limited with persistent exponential backoff.
- **A05 Security Misconfiguration** — strict security headers incl. CSP, HSTS,
  `X-Content-Type-Options`, `Referrer-Policy`, and `frame-ancestors 'none'`
  (`next.config.js`); the container runs as a non-root user; production source
  maps are disabled.
- **A06 Vulnerable & Outdated Components** — `npm audit` runs in CI.
- **A07 Identification & Authentication Failures** — httpOnly/SameSite=Strict
  session cookie with idle + absolute timeouts; wrong-PIN detection via GCM auth
  failure (no separate password hash to leak).
- **A08 Software & Data Integrity** — TLS fingerprint pinning per host; ISO
  download checksums passed through to Proxmox when provided.
- **A09 Logging & Monitoring** — privileged actions are recorded in an audit log
  that never contains secrets (`audit()` in `lib/db.ts`).
- **A10 SSRF** — the host base-URL and ISO-from-URL inputs pass through
  `lib/ssrf.ts`, which restricts schemes and blocks loopback/link-local/RFC1918/
  cloud-metadata targets by default (host URLs opt into private ranges; ISO
  downloads do so only via `PROXLINK_ALLOW_PRIVATE_ISO=1`).

## Operational guidance
- Run ProxLink only on a trusted/VPN network and terminate TLS in front of it for
  production use.
- Create a dedicated Proxmox API token with the least privilege needed.
- Back up the `/data` volume (contains the encrypted SQLite database).

## Reporting
Open a private security advisory on the repository rather than a public issue.
