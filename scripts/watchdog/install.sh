#!/usr/bin/env bash
# Installs the ProxLink watchdog (systemd service + timer) on this machine.
# Run as root *inside* the ProxLink container/VM (not on the Proxmox host).
#
# Fresh installs: scripts/install-lxc.sh runs this automatically.
# Existing deployments: pull the latest code, then run this once:
#   pct exec <CTID> -- bash /opt/proxlink/scripts/watchdog/install.sh
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

install -m 0755 "$DIR/proxlink-watchdog.sh" /usr/local/bin/proxlink-watchdog.sh
install -m 0644 "$DIR/proxlink-watchdog.service" /etc/systemd/system/proxlink-watchdog.service
install -m 0644 "$DIR/proxlink-watchdog.timer" /etc/systemd/system/proxlink-watchdog.timer

systemctl daemon-reload
systemctl enable --now proxlink-watchdog.timer

echo "ProxLink watchdog installed — checks every 2 minutes, auto-restarts the"
echo "container (and the Docker daemon itself if it's wedged)."
echo
echo "Logs:    journalctl -u proxlink-watchdog.service -n 50"
echo "Optional alerts: create /etc/default/proxlink-watchdog with:"
echo "  PROXLINK_WATCHDOG_WEBHOOK=https://your-webhook-url"
echo "then: systemctl restart proxlink-watchdog.timer"
