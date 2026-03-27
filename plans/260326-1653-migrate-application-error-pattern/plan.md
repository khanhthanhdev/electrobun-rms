# Plan: Migrate ApplicationError Pattern

**Date:** 2026-03-26
**Priority:** High (Technical debt consolidation)
**Effort:** 2-4 hours
**Status:** Complete

---

## Overview

Consolidate error handling patterns by making `SyncError` extend `ApplicationError` and ensure consistent usage across all routes.

---

## Context

### Current State

The codebase has two parallel error handling patterns:

1. **`ApplicationError`** (`application/common/application-error.ts`)
   - Generic HTTP error handler
   - Properties: `message`, `status`
   - Used in: Scoring, Inspection, Events, Teams, Users routes

2. **`SyncError`** (`application/use-cases/sync/shared.ts`)
   - Domain-specific error for Sync operations
   - Properties: `code`, `message`, `status`, `issues?`
   - Extends: `Error` (NOT ApplicationError)
   - Used in: Sync routes only

### Problem

- `SyncError` duplicates `ApplicationError` functionality (status codes, messages)
- Two patterns create inconsistency for future domain errors
- Routes handle errors differently:
  - Scoring/Inspection: `isApplicationError()` type guard
  - Sync: `isSyncError()` type guard with custom response format

### Goal

- `SyncError` should **extend** `ApplicationError` for consistency
- Single error handling pattern across all routes
- Clear pattern for future domain-specific errors

---

## Architecture

### Target Structure

```typescript
// application/common/application-error.ts
export class ApplicationError extends Error {
  readonly status: number;
  constructor(message: string, status: number);
}

// application/use-cases/sync/shared.ts
export class SyncError extends ApplicationError {
  readonly code: string;      // Machine-readable error code
  readonly issues?: unknown;  // Optional validation details
  readonly status: 400 | 401 | 403 | 404 | 409 | 500;

  constructor(
    code: string,
    status: 400 | 401 | 403 | 404 | 409 | 500,
    message: string,
    issues?: unknown
  );
}
```

### Error Handling Pattern (All Routes)

```typescript
// Unified error handler in routes
const toErrorResponse = (error: unknown, c: Context) => {
  if (error instanceof ApplicationError) {
    return c.json(
      { error: "error-code", message: error.message },
      error.status
    );
  }
  // Fallback for unexpected errors
  return c.json({ error: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" }, 500);
};
```

---

## Implementation Steps

### Phase 1: Migrate SyncError to Extend ApplicationError

**Files to Modify:**
- `src/bun/server/application/use-cases/sync/shared.ts`

**Changes:**
1. Import `ApplicationError`
2. Make `SyncError extends ApplicationError`
3. Call `super(message, status)` in constructor
4. Keep `code` and `issues` properties
5. Update `isSyncError` type guard

**Before:**
```typescript
export class SyncError extends Error {
  constructor(code, status, message, issues) {
    super(message);
    this.name = "SyncError";
    this.code = code;
    this.status = status;
    this.issues = issues;
  }
}
```

**After:**
```typescript
import { ApplicationError } from "../../common/application-error";

export class SyncError extends ApplicationError {
  readonly code: string;
  readonly issues?: unknown;

  constructor(
    code: string,
    status: 400 | 401 | 403 | 404 | 409 | 500,
    message: string,
    issues?: unknown
  ) {
    super(message, status);
    this.code = code;
    this.issues = issues;
  }
}
```

---

### Phase 2: Unify Error Response Handler in Sync Routes

**File:** `src/bun/server/api/sync/sync.routes.ts`

**Current:**
```typescript
const toSyncErrorResponse = (error: unknown) => {
  if (isSyncError(error)) {
    return {
      body: { error: error.code, issues: error.issues, message: error.message },
      status: error.status,
    };
  }
  return { body: { error: "INTERNAL_SERVER_ERROR", message: "Unexpected error" }, status: 500 };
};
```

**After (optional cleanup):**
Keep as-is since Sync uses a different response format (includes `issues`). The handler already works correctly because `SyncError` will still have `code`, `issues`, `message`, and `status` properties.

---

### Phase 3: Add Centralized Error Handler (Optional Enhancement)

**New File:** `src/bun/server/api/common/error-handler.ts`

```typescript
import type { Context } from "hono";
import type { AppEnv } from "./app-env";
import { ApplicationError } from "../../application/common/application-error";
import { isSyncError } from "../../application/use-cases/sync/shared";

export const toErrorResponse = (c: Context<AppEnv>, error: unknown) => {
  if (error instanceof ApplicationError) {
    // SyncError-specific format includes code and issues
    if (isSyncError(error)) {
      return c.json(
        { error: error.code, issues: error.issues, message: error.message },
        error.status
      );
    }
    // Standard ApplicationError format
    return c.json({ error: "APPLICATION_ERROR", message: error.message }, error.status);
  }

  // Unexpected errors
  console.error("Unexpected error:", error);
  return c.json(
    { error: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" },
    500
  );
};
```

---

## Testing Strategy

### Unit Tests
- `shared.ts` - Test `SyncError` constructor and properties
- Verify `SyncError instanceof ApplicationError` returns `true`

### Integration Tests
- Sync routes - Verify error responses unchanged
- Trigger sync errors and validate response format

### Regression Tests
- Run existing test suite: `bun test`
- Verify no breaking changes to HTTP contracts

---

## Success Criteria

- [ ] `SyncError extends ApplicationError` compiles without errors
- [ ] All sync tests pass (existing tests cover error scenarios)
- [ ] Error responses in sync routes remain unchanged
- [ ] `SyncError` instances pass `instanceof ApplicationError` check

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking sync API contract | High | Keep response format identical |
| Tests fail due to inheritance | Medium | Update type guards if needed |
| Circular imports | Low | Careful import path management |

---

## Related Files

**To Modify:**
- `src/bun/server/application/use-cases/sync/shared.ts`

**To Create (Optional):**
- `src/bun/server/api/common/error-handler.ts`

**Tests:**
- `src/bun/server/api/sync/sync.service.test.ts` (existing)

---

## Todo List

- [x] Phase 1: Migrate `SyncError` to extend `ApplicationError`
- [x] Phase 2: Verify sync routes error handling still works
- [x] Run tests: `bun test`
- [x] Run build: `bun run build`
- [x] Phase 3 (Optional): Add centralized error handler - Skipped (not needed, existing handler works)

## Implementation Summary

**Files Modified:**
- `src/bun/server/application/use-cases/sync/shared.ts` - SyncError now extends ApplicationError

**Test Results:**
- All 10 sync tests pass
- Build passes without errors
- Linting passes

**Key Changes:**
1. `SyncError` now extends `ApplicationError` instead of `Error`
2. Constructor calls `super(message, status)`
3. `isSyncError` type guard still works correctly via `instanceof SyncError`
4. `SyncError instanceof ApplicationError` returns `true`
5. Error response format in sync routes remains unchanged

---

## Unresolved Questions

None.
