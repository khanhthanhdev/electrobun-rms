# Autoresearch: SSE + TinyBase sync reliability

## Objective
Reduce hidden sync failures in SSE + TinyBase cross-client update flows, especially reconnect/error paths that can silently stop refresh or surface wrong connection state.

## Metrics
- **Primary**: `sync_error_count` (unitless, lower is better) — total detected hidden reliability issues in scoped sync code.
- **Secondary**:
  - `reset_guard_issues` — hooks that can miss refresh after version reset/reconnect.
  - `fatal_error_class_issues` — service-level fatal error class mismatches that can break stop-state handling.
  - `scan_ms` — health scan runtime.

## How to Run
`./autoresearch.sh` — runs TypeScript compile pre-check + sync health scan and prints `METRIC` lines.

## Files in Scope
- `src/mainview/features/inspection/hooks/use-realtime-refresh.ts`
- `src/mainview/features/scoring/hooks/use-scoring-realtime-refresh.ts`
- `src/mainview/features/display/hooks/use-display-realtime-refresh.ts`
- `src/mainview/features/events/rankings/use-qualification-rankings-realtime-refresh.ts`
- `src/mainview/features/inspection/services/inspection-sync-service.ts`
- `src/mainview/features/scoring/services/scoring-sync-service.ts`
- `src/mainview/features/events/control/services/match-control-sync-service.ts`
- `src/mainview/shared/services/realtime-stream-service.ts`
- `scripts/realtime-sync-health.ts`

## Off Limits
- Server-side domain logic and DB schema
- Non-realtime feature modules
- Dependency upgrades / new packages

## Constraints
- Keep behavior backward-compatible for valid SSE payload flow.
- No new dependencies.
- Must remain compilable (`bunx tsc --noEmit`).
- Keep implementations simple (YAGNI/KISS/DRY).

## What's Been Tried
- **Baseline (kept):** `sync_error_count=7` (`reset_guard_issues=4`, `fatal_error_class_issues=3`).
- **Winning fix (kept):**
  - Added version rollback handling in realtime refresh hooks so reconnect resets cannot suppress the next snapshot-triggered refresh.
  - Replaced feature-local fatal error classes with aliases to shared `RealtimeFatalError` so hook `instanceof` checks correctly detect fatal 401/403 stop conditions.
  - Result: `sync_error_count=0`.
