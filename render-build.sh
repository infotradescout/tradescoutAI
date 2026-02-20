#!/bin/bash
set -e
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
(
  while true; do
    echo "[build-heartbeat] $(date -u +%Y-%m-%dT%H:%M:%SZ) npm run build still running..."
    sleep 20
  done
) &
HB_PID=$!
trap 'kill "$HB_PID" 2>/dev/null || true' EXIT
npm run build
