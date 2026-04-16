#!/usr/bin/env bash
set -euo pipefail

bunx tsc --noEmit >/dev/null
bun scripts/realtime-sync-health.ts
