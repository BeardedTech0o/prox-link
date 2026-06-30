# ProxLink

A mobile-first PWA to manage one or more **Proxmox VE** hosts from your phone —
VMs & containers, lifecycle, configuration, create wizard, ISO-from-URL,
snapshots, backups, and console access. Self-hosted, designed to drop straight
onto Proxmox as an LXC.

> Built with Next.js + Tailwind. Talks to Proxmox via the REST API using API
> tokens, through a small backend-for-frontend that holds your (encrypted)
> credentials. See [`SECURITY.md`](./SECURITY.md) for the security model.

## Features

- 📱 Installable PWA, light/dark theme + accent picker
- 🔐 App-lock: PIN/passphrase unlock; Proxmox tokens encrypted at rest (AES-256-GCM)
- 🖧 Connect multiple hosts (and clusters); aggregated guest dashboard
- ▶️ VM/LXC lifecycle: start / shutdown / reboot / stop
- 🧰 Create VMs & containers; edit guest configuration
- 💿 Download ISOs / templates from a URL
- 🗂️ Snapshots (create / rollback / delete) and backups (`vzdump`)
- 🖥️ Console: noVNC for VMs, xterm for containers (via a WebSocket proxy)
- 🧾 Recent tasks across all hosts
- 🛡️ OWASP-aligned: allowlisted proxy, SSRF guard, strict CSP, audit log

---

## Setup overview

There are two halves to getting started:

1. **[Create a Proxmox API token](#1-create-a-proxmox-api-token)** ProxLink will use to talk to your host.
2. **[Deploy ProxLink on Proxmox](#2-deploy-proxlink-on-proxmox)** (as an LXC), then **[add your host in the app](#3-first-run--add-your-host)**.

You can do them in either order, but you'll need the token's **secret** (shown
only once) when you add the host in the app.

---

## 1. Create a Proxmox API token

ProxLink authenticates with a **Proxmox API token** (no password is stored). A
token belongs to a user and looks like `user@realm!tokenname`, paired with a
secret UUID.

> [!IMPORTANT]
> Proxmox tokens have **Privilege Separation** *on* by default, which means the
> token starts with **no** permissions even if its user is an admin. Either turn
> Privilege Separation **off** (the token inherits the user's rights), or grant
> the token its own permissions (see [token privileges](#token-privileges)).

### Option A — Web UI

1. Log into the Proxmox web UI as an admin.
2. **Datacenter → Permissions → API Tokens → Add**.
3. Pick a **User** (e.g. `root@pam`), set a **Token ID** (e.g. `proxlink`).
4. For the easiest homelab setup, **uncheck “Privilege Separation”** so the token
   inherits the user's permissions. (For least privilege, leave it on and grant
   permissions as in [token privileges](#token-privileges).)
5. Click **Add** and **copy the secret now** — it is shown only once.

You now have a Token ID like `root@pam!proxlink` and a secret UUID.

### Option B — Shell on the Proxmox host

```bash
# Create a token for root@pam with privilege separation disabled (inherits root)
pveum user token add root@pam proxlink --privsep 0
# ^ prints a table containing the token's "value" (the secret) — copy it now.
```

Least-privilege alternative (dedicated user + role):

```bash
# A role with everything ProxLink's v1 features use
pveum role add ProxLink --privs \
  "VM.Audit VM.PowerMgmt VM.Console VM.Config.Disk VM.Config.CDROM \
   VM.Config.CPU VM.Config.Memory VM.Config.Network VM.Config.Options \
   VM.Allocate VM.Snapshot VM.Backup Datastore.Audit Datastore.AllocateSpace \
   Datastore.AllocateTemplate Sys.Audit Pool.Audit"

pveum user add proxlink@pve --password '<choose-one>'
pveum acl modify / --user proxlink@pve --role ProxLink
# Create a privilege-separated token AND grant it the same role:
pveum user token add proxlink@pve app --privsep 1
pveum acl modify / --token 'proxlink@pve!app' --role ProxLink
```

### Token privileges

| ProxLink feature              | Proxmox privileges                                              |
| ----------------------------- | -------------------------------------------------------------- |
| See guests / status / config  | `VM.Audit`, `Sys.Audit`, `Pool.Audit`                          |
| Start / stop / reboot         | `VM.PowerMgmt`                                                  |
| Edit configuration            | `VM.Config.*`                                                  |
| Create / delete guests        | `VM.Allocate`, `Datastore.AllocateSpace`                       |
| Snapshots                     | `VM.Snapshot`                                                  |
| Backups (`vzdump`)            | `VM.Backup`, `Datastore.AllocateSpace`, `Datastore.Audit`      |
| Download ISO / template       | `Datastore.AllocateTemplate`, `Datastore.Audit`                |
| **Console** (noVNC / xterm)   | `VM.Console`                                                   |

> If the console fails to connect, it is almost always a missing `VM.Console`
> privilege or a token with Privilege Separation on but no ACL granted.

---

## 2. Deploy ProxLink on Proxmox

ProxLink is meant to run **inside your network**, on the Proxmox box itself, as a
small LXC. Pick one of the following.

### Option A — One-line LXC installer (recommended)

Run this **on a Proxmox host** (via the node shell or SSH). It creates a Debian
LXC, installs Docker, and starts ProxLink:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/beardedtech0o/prox-link/claude/proxmox-mobile-app-fomguw/scripts/install-lxc.sh)"
```

When it finishes it prints the container's IP and URL, e.g.
`http://10.0.0.50:3000`. Review the script before running it; you can tune it
with env vars:

```bash
CTID=131 HOSTNAME=proxlink DISK_GB=6 RAM_MB=1024 CORES=2 \
BRIDGE=vmbr0 STORAGE=local-lvm \
bash -c "$(curl -fsSL https://raw.githubusercontent.com/beardedtech0o/prox-link/claude/proxmox-mobile-app-fomguw/scripts/install-lxc.sh)"
```

### Option B — Manual LXC + Docker Compose

1. In the Proxmox UI, create a **Debian 12** LXC (unprivileged is fine; enable
   **nesting** so Docker runs: *Options → Features → nesting=1*). 1 vCPU / 1 GB
   RAM / 4 GB disk is plenty.
2. Start it, open its console, and install Docker:
   ```bash
   apt update && apt install -y ca-certificates curl git
   curl -fsSL https://get.docker.com | sh
   ```
3. Clone and start ProxLink:
   ```bash
   git clone https://github.com/beardedtech0o/prox-link.git /opt/proxlink
   cd /opt/proxlink
   docker compose up -d --build
   ```
4. Browse to `http://<container-ip>:3000`.

### Option C — Docker Compose anywhere

Any Docker host on the same network (NAS, VM, mini-PC) works:

```bash
git clone https://github.com/beardedtech0o/prox-link.git && cd prox-link
docker compose up -d --build
# open http://<host-ip>:3000
```

The SQLite database (your encrypted host list) persists in the `proxlink-data`
volume — back it up if you care about your saved hosts.

---

## 3. First run — add your host

1. Open `http://<proxlink-ip>:3000`. On a phone you can **Add to Home Screen** to
   install it as an app.
2. **Set a PIN / passphrase.** This encrypts your stored API tokens — there is no
   recovery if you forget it.
3. **Hosts → Add** and fill in:
   - **Base URL** — your Proxmox API endpoint **including the port**, e.g.
     `https://192.168.1.10:8006`.
   - **API token ID** — e.g. `root@pam!proxlink`.
   - **API token secret** — the UUID you copied when creating the token.
   - **Verify TLS** — leave **off** for a typical self-signed Proxmox cert;
     ProxLink pins the certificate fingerprint on first connect instead.
4. Tap **Test connection** (confirms the token works and pins the cert), then
   **Save host**. Your VMs and containers appear on the dashboard.

Add more hosts the same way — the dashboard aggregates all of them, and a single
host that's part of a cluster will surface the whole cluster's guests.

---

## Configuration

| Env var                      | Default     | Purpose                                   |
| ---------------------------- | ----------- | ----------------------------------------- |
| `PORT`                       | `3000`      | HTTP port                                 |
| `HOST`                       | `0.0.0.0`   | Bind address                              |
| `PROXLINK_DATA_DIR`          | `/data`     | Directory for the SQLite database         |
| `PROXLINK_ALLOW_PRIVATE_ISO` | `0`         | Allow ISO downloads from private/LAN URLs |

> For production, run ProxLink behind a reverse proxy with HTTPS, and keep it on
> a trusted/VPN network. See [`SECURITY.md`](./SECURITY.md).

## Updating

```bash
cd /opt/proxlink   # or wherever you cloned it
git pull
docker compose up -d --build
```

## Development

```bash
npm install
npm run dev        # custom server (Next + console WebSocket proxy) on :3000
npm run typecheck
npm run lint
npm test
npm run build
```

## Roadmap

Implemented (v1): app-lock, multi-host, dashboard, lifecycle, create wizard,
config editing, ISO-from-URL, snapshots, backups, console, tasks. Planned: live
monitoring charts, push notifications, and cluster / storage / network / firewall
/ user administration.
