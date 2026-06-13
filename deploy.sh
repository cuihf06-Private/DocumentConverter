#!/usr/bin/env bash
set -euo pipefail

# Load nvm so node/npm are available regardless of how this script is invoked
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  source "$NVM_DIR/nvm.sh"
  nvm use 24 --silent 2>/dev/null || nvm use node --silent 2>/dev/null || true
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$APP_DIR/.runtime"
BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
BACKEND_LOG="$RUNTIME_DIR/backend.log"
BACKEND_PORT="${PORT:-3003}"

usage() {
  echo "Usage: ./deploy.sh [--stop|--status]"
}

is_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

stop_pid_file() {
  local file="$1"
  local label="$2"
  if [[ ! -f "$file" ]]; then
    return
  fi

  local pid
  pid="$(cat "$file" 2>/dev/null || true)"
  if is_running "$pid"; then
    echo "Stopping $label (pid $pid)"
    kill "$pid" 2>/dev/null || true
  fi
  rm -f "$file"
}

managed_pids() {
  ps -eo pid=,cmd= | while read -r pid cmd; do
    case "$cmd" in
      *"node server.js"*)
        local cwd
        cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null || true)"
        if [[ "$cwd" == "$APP_DIR" ]]; then
          echo "$pid"
        fi
        ;;
    esac
  done
}

wait_http() {
  local url="$1"
  local label="$2"
  local code
  for _ in {1..20}; do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)"
    if [[ "$code" != "000" ]]; then
      return
    fi
    sleep 0.5
  done
  echo "$label did not respond at $url"
  exit 1
}

stop_services() {
  mkdir -p "$RUNTIME_DIR"
  stop_pid_file "$BACKEND_PID_FILE" "backend"

  local pids
  pids="$(managed_pids | sort -rn || true)"
  if [[ -n "$pids" ]]; then
    echo "$pids" | while read -r pid; do
      if is_running "$pid"; then
        echo "Stopping managed process (pid $pid)"
        kill "$pid" 2>/dev/null || true
      fi
    done
  fi

  sleep 1

  pids="$(managed_pids | sort -rn || true)"
  if [[ -n "$pids" ]]; then
    echo "$pids" | while read -r pid; do
      if is_running "$pid"; then
        echo "Force stopping managed process (pid $pid)"
        kill -9 "$pid" 2>/dev/null || true
      fi
    done
  fi
}

start_services() {
  mkdir -p "$RUNTIME_DIR"

  cd "$APP_DIR"
  echo "Installing dependencies"
  npm install --silent

  # Ensure required directories exist
  mkdir -p uploads outputs

  echo "Starting backend on port $BACKEND_PORT"
  PORT="$BACKEND_PORT" setsid bash -c 'exec node server.js' >"$BACKEND_LOG" 2>&1 &
  echo "$!" > "$BACKEND_PID_FILE"

  sleep 1
  local backend_pid
  backend_pid="$(cat "$BACKEND_PID_FILE")"
  if ! is_running "$backend_pid"; then
    echo "Backend failed to start. See $BACKEND_LOG"
    cat "$BACKEND_LOG"
    exit 1
  fi

  wait_http "http://127.0.0.1:$BACKEND_PORT/api/health" "Backend"

  echo "Deployment complete"
  echo "Backend:  http://127.0.0.1:$BACKEND_PORT"
  echo "Logs:     $RUNTIME_DIR"
}

show_status() {
  local pid
  if [[ -f "$BACKEND_PID_FILE" ]]; then
    pid="$(cat "$BACKEND_PID_FILE" 2>/dev/null || true)"
    if is_running "$pid"; then
      echo "Backend:  running (pid $pid) on port $BACKEND_PORT"
    else
      echo "Backend:  stopped"
    fi
  else
    echo "Backend:  not deployed"
  fi
}

case "${1:-}" in
  "")
    stop_services
    start_services
    ;;
  "--stop")
    stop_services
    echo "Services stopped"
    ;;
  "--status")
    show_status
    ;;
  "-h"|"--help")
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
