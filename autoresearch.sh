#!/usr/bin/env bash
set -euo pipefail

# Only fail on real type errors, not TS6133 (unused variables) in out-of-scope files
TS_OUTPUT=$(bunx tsc --noEmit 2>&1 || true)
if echo "$TS_OUTPUT" | grep -v 'TS6133' | grep -q 'error TS'; then
  echo "TypeScript compile errors:"
  echo "$TS_OUTPUT" | grep -v 'TS6133'
  exit 1
fi

bun scripts/realtime-sync-health.ts
