#!/usr/bin/env bash
# ProxLink — Proxmox LXC installer (tteck-style).
# Run on a Proxmox VE host. Creates a Debian 12 LXC, installs Docker, and starts
# ProxLink via docker compose. Review before running; it creates a container.
set -euo pipefail

CTID="${CTID:-}"                         # auto-pick next free id if empty
HOSTNAME="${HOSTNAME:-proxlink}"
DISK_GB="${DISK_GB:-4}"
RAM_MB="${RAM_MB:-1024}"
CORES="${CORES:-2}"
BRIDGE="${BRIDGE:-vmbr0}"
STORAGE="${STORAGE:-local-lvm}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
REPO_URL="${REPO_URL:-https://github.com/beardedtech0o/prox-link.git}"
TEMPLATE="debian-12-standard_12.7-1_amd64.tar.zst"

command -v pct >/dev/null || { echo "This must run on a Proxmox VE host (pct not found)."; exit 1; }

[ -z "$CTID" ] && CTID="$(pvesh get /cluster/nextid)"
echo "==> Using CTID $CTID"

echo "==> Ensuring LXC template is present"
pveam update >/dev/null 2>&1 || true
if ! pveam list "$TEMPLATE_STORAGE" | grep -q "$TEMPLATE"; then
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"
fi

echo "==> Creating container"
pct create "$CTID" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE}" \
  --hostname "$HOSTNAME" \
  --cores "$CORES" --memory "$RAM_MB" \
  --rootfs "${STORAGE}:${DISK_GB}" \
  --net0 "name=eth0,bridge=${BRIDGE},ip=dhcp" \
  --features "nesting=1" \
  --unprivileged 1 \
  --onboot 1

pct start "$CTID"
sleep 5

echo "==> Installing Docker + ProxLink inside the container"
pct exec "$CTID" -- bash -c '
  set -euo pipefail
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ca-certificates curl git
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
'
pct exec "$CTID" -- bash -c "git clone '$REPO_URL' /opt/proxlink && cd /opt/proxlink && docker compose up -d --build"

IP="$(pct exec "$CTID" -- bash -c "hostname -I | awk '{print \$1}'")"
echo "============================================================"
echo " ProxLink is starting in CTID $CTID"
echo " Open: http://${IP}:3000"
echo "============================================================"
