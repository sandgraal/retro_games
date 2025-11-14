#!/usr/bin/env bash
set -euo pipefail

if ! command -v psql >/dev/null 2>&1; then
  if [[ $EUID -ne 0 ]]; then
    if command -v sudo >/dev/null 2>&1; then
      exec sudo "$0" "$@"
    else
      echo "Error: psql is missing and this script must run as root to install packages." >&2
      exit 1
    fi
  fi

  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Error: apt-get package manager not available. Install the PostgreSQL client manually." >&2
    exit 1
  fi

  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends postgresql-client
else
  echo "psql is already installed: $(command -v psql)"
fi
