# Phase 4: Cleanup Legacy Services

**Status:** Blocked
**Priority:** Low
**Effort:** 30 minutes
**Blocked By:** Phases 1, 2, 3

## Overview

Remove legacy service files after all migrations complete.
This phase removes technical debt and consolidates error handling.

## Files to Delete

| File | Reason |
|------|--------|
| `src/bun/server/services/event-rankings-service.ts` | Rankings migrated to use-cases |
| `src/bun/server/services/event-print-lists-service.ts` | Print lists migrated to repository |
| `src/bun/server/services/event-teams-service.ts` | Merge into Teams repository |
| `src/bun/server/services/manual-event-service.ts` | ServiceError no longer needed |

## Pre-Conditions

Before this phase can execute:

- [ ] Phase 1 complete (Rankings routes working)
- [ ] Phase 2 complete (Auth use-cases working)
- [ ] Phase 3 complete (Print lists repository working)
- [ ] All tests passing
- [ ] Build succeeds

## Implementation Steps

### Step 1: Verify No References

```bash
# Search for any remaining imports
grep -r "event-rankings-service" src/
grep -r "event-print-lists-service" src/
grep -r "event-teams-service" src/
grep -r "manual-event-service" src/
grep -r "ServiceError" src/
```

### Step 2: Delete Files

```bash
rm src/bun/server/services/event-rankings-service.ts
rm src/bun/server/services/event-print-lists-service.ts
rm src/bun/server/services/event-teams-service.ts
rm src/bun/server/services/manual-event-service.ts
```

### Step 3: Clean Up Services Directory

If `services/` directory is now empty:

```bash
rmdir src/bun/server/services
```

### Step 4: Verify ApplicationError Only

```bash
# Verify only ApplicationError is used
grep -r "ApplicationError" src/bun/server/ | wc -l
grep -r "ServiceError" src/bun/server/  # Should return nothing
```

## Success Criteria

- [ ] All 4 service files deleted
- [ ] No broken imports
- [ ] `bun run build` succeeds
- [ ] All tests pass
- [ ] No `ServiceError` references in codebase

## Risk Assessment

**Low Risk** - All functionality migrated to use-cases before deletion.
If any broken imports remain, they will fail at build time.

## Rollback Plan

If deletion causes issues:
1. `git restore src/bun/server/services/`
2. Re-run tests to identify missing migration
