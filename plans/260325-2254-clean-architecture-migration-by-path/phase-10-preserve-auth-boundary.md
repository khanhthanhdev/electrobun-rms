# Phase 10: Preserve Auth Boundary

**Parent Plan:** `./plan.md`
**Priority:** 10
**Status:** Done
**Effort:** As needed for compatibility only

## Context Links

- Parent path plan: [plan.md](./plan.md)
- Current auth files: `src/bun/server/api/auth/*`
- Users phase: [phase-07-migrate-users-domain.md](./phase-07-migrate-users-domain.md)

## Overview

Auth is not part of this Clean Architecture migration. Keep login, session, cookie, and middleware behavior in `api/auth` unless a separate auth initiative is approved later.

## Key Insights

- Auth is framework-coupled and not the highest-leverage target for this migration.
- The only planned change is decoupling Users from Auth internals.
- Pulling Auth into this plan would expand scope and risk without helping the path-by-path migration succeed.

## Requirements

- Functional:
  - Preserve login, me, logout, middleware, and schema behavior.
  - Support import adjustments required by the Users migration.
- Non-functional:
  - Do not introduce a fake clean architecture layer around framework-owned auth concerns.
  - Keep scope limited to compatibility.

## Architecture

- `api/auth/*` remains the owner of authentication transport and middleware behavior.
- Users consumes its own repository path after migration and stops relying on Auth internals.

## Related Code Files

- Modify:
  - `src/bun/server/api/auth/auth.service.ts`
  - `src/bun/server/api/auth/auth.routes.ts`
  - `src/bun/server/api/auth/auth.middleware.ts`
- Create:
  - None in this plan
- Delete:
  - None in this plan

## Implementation Steps

1. Leave Auth unchanged while earlier migration paths are executed.
2. During the Users migration, remove any Users dependency on `auth.service.ts`.
3. Apply only the import and compatibility fixes needed to keep Auth compiling and behaving the same.
4. Defer any deeper auth redesign to a separate plan.

## Todo List

- [x] Auth route behavior is unchanged.
- [x] Users no longer imports Auth internals.
- [x] No new Auth abstraction layer is introduced.

## Success Criteria

- Auth keeps working exactly as before.
- The Clean Architecture migration does not drag Auth into unnecessary scope.

## Risk Assessment

- Main risk is accidental breakage from Users/Auth decoupling.
- Scope creep is the other risk and must be rejected.

## Security Considerations

- Preserve cookie, token, and middleware behavior.
- Do not weaken auth checks while adjusting imports.

## Next Steps

- If the project later adopts a new auth stack, create a separate dedicated migration plan.
