#!/usr/bin/env bash
set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: ./force_restart.sh <service>" >&2
  exit 1
fi

docker compose up -d --no-deps --force-recreate "$1"
