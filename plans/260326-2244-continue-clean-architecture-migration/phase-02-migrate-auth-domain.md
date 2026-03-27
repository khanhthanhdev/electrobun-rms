# Phase 2: Migrate Auth Domain

**Status:** In Progress
**Priority:** High
**Effort:** 1 hour

## Overview

Keep auth logic in a simple service module (`api/auth/auth.service.ts`) without full clean architecture.
Auth is a cross-cutting concern but doesn't need repository/use-case abstraction.

## Approach: Simple Service Module

**Rationale:**
- Auth is straightforward: authenticate → issue token → log events
- No business rules complexity requiring use-case abstraction
- Keep `db` access inside service (acceptable for auth concerns)
- Follows YAGNI - current `auth.service.ts` pattern works fine

## Files to Keep

| File | Purpose |
|------|---------|
| `src/bun/server/api/auth/auth.service.ts` | Auth functions (unchanged pattern) |
| `src/bun/server/api/auth/auth.constants.ts` | JWT config |
| `src/bun/server/api/auth/auth.schema.ts` | Validation schemas |
| `src/bun/server/api/auth/auth.middleware.ts` | JWT middleware |
| `src/bun/server/api/auth/auth.routes.ts` | Routes |

## What Changes from Original Plan

**REMOVED (over-engineering):**
- ~~`application/interfaces/auth-repository.ts`~~
- ~~`infrastructure/adapters/auth/sqlite-auth-repository.ts`~~
- ~~`application/use-cases/auth/*`~~ (4 use-case files)
- ~~`application/dtos/auth.ts`~~

**KEPT (simple & working):**
- `auth.service.ts` stays in `api/auth/` with direct DB access
- Service functions exported and used by routes
- Middleware uses service function for JWT secret

## Implementation: Minimal Changes

### auth.middleware.ts (minor tweak)
```typescript
// Keep importing from auth.service
import { getJwtSecret } from "./auth.service";

// Use directly - no repository needed
const secret = await getJwtSecret();
```

### auth.routes.ts (minor tweak)
```typescript
// Keep importing from auth.service
import {
  authenticateUser,
  issueAccessToken,
  recordLogin,
  recordLogout,
} from "./auth.service";

// Use functions directly - no use-case wrapper
const user = await authenticateUser(body);
const token = await issueAccessToken(user);
```

## Success Criteria

- [ ] `auth.service.ts` kept (not deleted)
- [ ] All auth endpoints functional
- [ ] JWT middleware works
- [ ] Login/logout event logging preserved
- [ ] No over-engineering (no auth use-cases, no auth repository)

## Security Considerations

- Password hashing: Bun.password.verify (unchanged)
- JWT secret: DB-backed (unchanged)
- Role assignment: preserved
