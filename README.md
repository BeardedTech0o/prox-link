# ProxLink

ProxLink is a mobile first PWA for managing one or more Proxmox VE hosts from
your phone. It talks to Proxmox over its REST API using API tokens, through a
small backend that holds your encrypted credentials, and it is meant to be
self hosted, ideally dropped straight onto Proxmox itself as an LXC.

Built with Next.js and Tailwind. See [`SECURITY.md`](./SECURITY.md) for the
full security model.

## What it does

Unlock. ProxLink is gated behind a PIN or passphrase you choose on first run.
Your Proxmox API tokens are encrypted at rest with 256 bit AES in GCM mode,
and the key only ever lives in memory while the app is unlocked.

Multiple hosts. Connect as many Proxmox hosts or clusters as you like. The
Guests dashboard aggregates every VM and container across all of them into one
list, grouped by host, with live status.

Guest lifecycle. Start, shutdown, reboot, and force stop a VM or container
from its detail page, with confirmation on anything destructive.

Configuration editing. View and edit a guest's name or hostname, core count,
memory, and boot behavior directly from the app.

Create wizard. Build a new QEMU VM or LXC container from your phone: pick the
host, node, disk, image, and network bridge, then watch a live progress view
while Proxmox builds it.

ISO and template downloads. Pull an ISO or container template straight from a
URL into Proxmox storage, with the destination filename validated and auto
filled from the URL itself.

Snapshots and backups. Create, roll back, and delete snapshots. Trigger a
vzdump backup on demand.

Console access. Open a full VNC console for a QEMU VM, or a terminal for an
LXC container, both over a serverside WebSocket proxy so the ticket never
reaches the browser. A phone's onscreen keyboard is wired up for both, and the
VNC view scales to fill the screen rather than leaving it tiny in a corner.

Node shell. Beyond guest consoles, open a shell on the Proxmox node itself,
the same thing Proxmox's own "Datacenter > Node > Shell" gives you, right from
the Hosts page.

Tasks. See recent activity across every connected host in one place.

Theme and accent. Light or dark mode, with a choice of accent colors,
installable as a home screen app.

Security posture. Every Proxmox call goes through an allowlisted proxy rather
than arbitrary passthrough, a guard blocks serverside requests to private or
loopback addresses for the ISO download feature, strict security headers and
a content security policy are set on every response, and privileged actions
are written to an audit log.

## Setup overview

There are two halves to getting started.

1. Create a Proxmox API token that ProxLink will use to talk to your host.
2. Deploy ProxLink on Proxmox, typically as an LXC, then add your host inside
   the app.

You can do these in either order, but you will need the token's secret, shown
only once when it is created, when you add the host in the app.

## 1. Create a Proxmox API token

ProxLink authenticates with a Proxmox API token, never a stored password. A
token belongs to a user and looks like `user@realm!tokenname`, paired with a
secret UUID.

Proxmox tokens have Privilege Separation turned on by default, which means a
brand new token starts with no permissions at all, even if its user is an
admin. Either turn Privilege Separation off so the token inherits the user's
rights, or grant the token its own permissions as described below.

### Option A: web UI

1. Log into the Proxmox web UI as an admin.
2. Go to Datacenter, then Permissions, then API Tokens, then Add.
3. Pick a user, such as `root@pam`, and set a token ID, such as `proxlink`.
4. For the simplest homelab setup, uncheck Privilege Separation so the token
   inherits the user's permissions. For least privilege, leave it checked and
   grant permissions as described in Token privileges below.
5. Click Add and copy the secret immediately. It is shown only once.

You now have a token ID like `root@pam!proxlink` and a secret UUID.

### Option B: shell on the Proxmox host

Create a token for `root@pam` with privilege separation disabled, so it
inherits root's permissions:

```bash
pveum user token add root@pam proxlink --privsep 0
```

This prints a table containing the token's value, which is the secret. Copy
it now.

For a least privilege setup, create a dedicated user and role instead:

```bash
pveum role add ProxLink --privs \
  "VM.Audit VM.PowerMgmt VM.Console VM.Config.Disk VM.Config.CDROM \
   VM.Config.CPU VM.Config.Memory VM.Config.Network VM.Config.Options \
   VM.Allocate VM.Snapshot VM.Backup Datastore.Audit Datastore.AllocateSpace \
   Datastore.AllocateTemplate Sys.Audit Sys.Console Pool.Audit"

pveum user add proxlink@pve --password '<choose one>'
pveum acl modify / --user proxlink@pve --role ProxLink
pveum user token add proxlink@pve app --privsep 1
pveum acl modify / --token 'proxlink@pve!app' --role ProxLink
```

### Token privileges

Different features need different privileges. If something silently does not
work, this is the first place to check.

Seeing guests, their status, and their configuration needs `VM.Audit`,
`Sys.Audit`, and `Pool.Audit`.

Starting, stopping, and rebooting needs `VM.PowerMgmt`.

Editing configuration needs the relevant `VM.Config.*` privilege.

Creating or deleting guests needs `VM.Allocate` and
`Datastore.AllocateSpace`.

Snapshots need `VM.Snapshot`.

Backups need `VM.Backup`, `Datastore.AllocateSpace`, and `Datastore.Audit`.

Downloading an ISO or template needs `Datastore.AllocateTemplate` and
`Datastore.Audit`.

The guest console, both VNC and terminal, needs `VM.Console`.

The node shell needs `Sys.Console`.

If the console fails to connect, it is almost always a missing `VM.Console`
or `Sys.Console` privilege, or a token with Privilege Separation on but no
ACL granted to it.

## 2. Deploy ProxLink on Proxmox

ProxLink is meant to run inside your network, on the Proxmox box itself, as a
small LXC. Pick one of the options below.

### Option A: one line LXC installer, recommended

Run this on a Proxmox host, either from the node shell or over SSH. It
creates a Debian LXC, installs Docker, and starts ProxLink.

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/BeardedTech0o/prox-link/main/scripts/install-lxc.sh)"
```

When it finishes it prints the container's IP and URL, something like
`http://10.0.0.50:3000`. Review the script before running it. You can tune it
with environment variables:

```bash
CTID=131 CT_HOSTNAME=proxlink DISK_GB=10 RAM_MB=1024 CORES=2 \
BRIDGE=vmbr0 STORAGE=local-lvm \
bash -c "$(curl -fsSL https://raw.githubusercontent.com/BeardedTech0o/prox-link/main/scripts/install-lxc.sh)"
```

### Option B: manual LXC plus Docker Compose

1. In the Proxmox UI, create a Debian 12 LXC. Unprivileged is fine. Enable
   nesting under Options, then Features, so Docker can run inside it. One
   vCPU, one GB of RAM, and ten GB of disk is a comfortable amount of room for
   the Docker build.
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

4. Browse to `http://<container ip>:3000`.

### Option C: Docker Compose anywhere

Any Docker host on the same network, a NAS, a VM, a mini PC, works the same
way:

```bash
git clone https://github.com/beardedtech0o/prox-link.git && cd prox-link
docker compose up -d --build
```

Then open `http://<host ip>:3000`.

The SQLite database, which holds your encrypted host list, persists in the
`proxlink-data` volume. Back it up if you care about keeping your saved
hosts.

## 3. First run: add your host

1. Open `http://<proxlink ip>:3000`. On a phone, use Add to Home Screen to
   install it like a native app.
2. Set a PIN or passphrase. This encrypts your stored API tokens. There is no
   recovery if you forget it.
3. Go to Hosts, then Add, and fill in the base URL of your Proxmox API
   endpoint including the port, for example `https://192.168.1.10:8006`, the
   API token ID, for example `root@pam!proxlink`, and the API token secret,
   the UUID copied when the token was created. Leave Verify TLS off for a
   typical self signed Proxmox certificate. ProxLink pins the certificate's
   fingerprint on first connect instead of requiring a trusted CA.
4. Tap Test connection to confirm the token works and pin the certificate,
   then Save host. Your VMs and containers appear on the dashboard.

Add more hosts the same way. The dashboard aggregates all of them, and a
single host that is part of a cluster surfaces the whole cluster's guests.

## Configuration

`PORT` sets the HTTP port the server listens on and defaults to `3000`.

`HOST` sets the bind address and defaults to `0.0.0.0`.

`PROXLINK_DATA_DIR` sets the directory used for the SQLite database and
defaults to `/data`.

`PROXLINK_ALLOW_PRIVATE_ISO` allows ISO downloads from private or LAN URLs
when set to `1`, and defaults to `0`.

For production use, run ProxLink behind a reverse proxy with HTTPS, and keep
it on a trusted or VPN only network. See [`SECURITY.md`](./SECURITY.md).

## Updating

```bash
cd /opt/proxlink
git pull
docker compose up -d --build
```

## Watchdog, automatic recovery

The Compose file sets `restart: unless-stopped`, but that only helps if the
Docker daemon itself is healthy. It does nothing if the daemon gets wedged,
which can happen after certain Proxmox LXC backup modes freeze the
filesystem mid backup, leaving the container stopped without restarting.

Installs done through `scripts/install-lxc.sh` get a watchdog automatically:
a systemd timer that runs every two minutes, restarts the Docker daemon if it
is unresponsive, and brings the container back up if it is not running.

To add it to a deployment that predates the watchdog:

```bash
pct exec <CTID> -- bash -c "cd /opt/proxlink && git pull"
pct exec <CTID> -- bash /opt/proxlink/scripts/watchdog/install.sh
```

To check that it is working:

```bash
pct exec <CTID> -- journalctl -u proxlink-watchdog.service -n 50
```

For optional alerts when it has to intervene, create
`/etc/default/proxlink-watchdog` inside the container with a webhook URL.
Discord, Slack, ntfy, and similar services all accept a simple JSON POST.

```
PROXLINK_WATCHDOG_WEBHOOK=https://your-webhook-url
```

Then run `pct exec <CTID> -- systemctl restart proxlink-watchdog.timer`.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run dev` starts the custom server, which combines Next.js with the
console WebSocket proxy, on port 3000.

## Roadmap

Implemented so far: app lock, multiple hosts, the aggregated dashboard,
guest lifecycle actions, configuration editing, the create wizard, ISO and
template downloads from a URL with live progress, snapshots, backups, guest
console access for both VMs and containers, node shell access, and a
cross host task view.

Planned: live monitoring charts, push notifications, and cluster, storage,
network, firewall, and user administration.
