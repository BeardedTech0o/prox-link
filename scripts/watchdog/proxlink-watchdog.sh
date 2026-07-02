#!/usr/bin/env bash
# ProxLink watchdog — detects a stopped container or a wedged Docker daemon
# (e.g. after an LXC backup filesystem freeze) and recovers it. Idempotent;
# safe to run on a timer. Installed by scripts/install-lxc.sh, or manually via
# scripts/watchdog/install.sh on an existing deployment.
set -uo pipefail

COMPOSE_DIR="${PROXLINK_DIR:-/opt/proxlink}"
CONTAINER="${PROXLINK_CONTAINER:-proxlink}"
WEBHOOK_URL="${PROXLINK_WATCHDOG_WEBHOOK:-}"
LOG_TAG="proxlink-watchdog"

log() {
  logger -t "$LOG_TAG" "$1" 2>/dev/null || true
  echo "$(date -Is) $1"
}

notify() {
  [ -n "$WEBHOOK_URL" ] || return 0
  curl -fsS -m 5 -X POST -H 'Content-Type: application/json' \
    -d "{\"content\":\"$1\"}" "$WEBHOOK_URL" >/dev/null 2>&1 || true
}

HOST="$(hostname)"

# 1. Is the Docker daemon itself responsive? (A wedged daemon is the failure
#    mode seen after some Proxmox LXC backup filesystem freezes.)
if ! timeout 10 docker info >/dev/null 2>&1; then
  log "Docker daemon unresponsive — restarting docker.service"
  systemctl restart docker
  sleep 5
  if ! timeout 10 docker info >/dev/null 2>&1; then
    log "Docker daemon still unresponsive after restart"
    notify "⚠️ ProxLink watchdog on ${HOST}: Docker daemon unresponsive even after restart — needs manual attention"
    exit 1
  fi
  log "Docker daemon recovered after restart"
fi

# 2. Is the app container actually running?
running="$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || true)"
if [ "$running" != "true" ]; then
  log "$CONTAINER is not running (state: ${running:-absent}) — bringing it up"
  ( cd "$COMPOSE_DIR" && docker compose up -d ) || true
  sleep 5
  running="$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || true)"
  if [ "$running" = "true" ]; then
    log "$CONTAINER recovered"
    notify "✅ ProxLink watchdog on ${HOST}: container was down, restarted successfully"
  else
    log "Failed to bring $CONTAINER back up"
    notify "🛑 ProxLink watchdog on ${HOST}: failed to restart the container — needs manual attention"
    exit 1
  fi
fi
