# ProxLink

A mobile-first PWA to manage one or more **Proxmox VE** hosts from your phone —
VMs & containers, lifecycle, configuration, snapshots, ISO-from-URL, and console
access. Self-hosted, designed to drop straight onto Proxmox as an LXC/VM.

> Built with Next.js + Tailwind. Talks to Proxmox via the REST API using API
> tokens, through a small backend-for-frontend that holds your (encrypted)
> credentials. See [`SECURITY.md`](./SECURITY.md) for the security model.

## Features

- 📱 Installable PWA, light/dark theme + accent picker
- 🔐 App-lock: PIN/passphrase unlock; Proxmox tokens encrypted at rest (AES-256-GCM)
- 🖧 Connect multiple hosts (and clusters); aggregated guest dashboard
- ▶️ VM/LXC lifecycle: start / shutdown / reboot / stop
- ⚙️ View & edit guest configuration
- 🖥️ Console access: noVNC for VMs, xterm for containers (via a WebSocket proxy)
- 🧾 Recent tasks across all hosts
- 🛡️ OWASP-aligned: allowlisted proxy, SSRF guard, strict CSP, audit log

## Quick start (Docker)

```bash
docker compose up -d --build
# open http://<server-ip>:3000
```

On first run you set a PIN, then add a host with a Proxmox **API token**:

1. In Proxmox: *Datacenter → Permissions → API Tokens* → create a token
   (e.g. `root@pam!proxlink`) and grant it the privileges you need.
2. In ProxLink: *Hosts → Add* → enter the base URL (e.g.
   `https://192.168.1.10:8006`), the token ID and secret, then **Test
   connection** (this also pins the self-signed TLS certificate).

## Install onto Proxmox as an LXC

Run on a Proxmox host:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/beardedtech0o/prox-link/claude/proxmox-mobile-app-fomguw/scripts/install-lxc.sh)"
```

Creates a Debian LXC, installs Docker, and starts ProxLink. Review the script
first.

## Development

```bash
npm install
npm run dev        # custom server (Next + console WebSocket proxy) on :3000
npm run typecheck
npm run lint
npm test
npm run build
```

## Configuration

| Env var                      | Default     | Purpose                                   |
| ---------------------------- | ----------- | ----------------------------------------- |
| `PORT`                       | `3000`      | HTTP port                                 |
| `PROXLINK_DATA_DIR`          | `./data`    | Directory for the SQLite database         |
| `PROXLINK_ALLOW_PRIVATE_ISO` | unset (`0`) | Allow ISO downloads from private/LAN URLs |

## Status

v1 in progress. Implemented: app-lock, multi-host, dashboard, lifecycle, config
editing, console, tasks. Coming next: create-guest wizard, ISO-from-URL UI,
snapshots & backups UI. See the project plan for the roadmap.
