# Phase 07: Migrate Users Domain

**Parent Plan:** `./plan.md`
**Priority:** 7
**Status:** Completed
**Effort:** 2-4 hours

## Context Links

- Parent path plan: [plan.md](./plan.md)
- Current users routes: `src/bun/server/api/users/users.routes.ts`
- Current users service: `src/bun/server/api/users/users.service.ts`
- Current auth files: `src/bun/server/api/auth/*`

## Overview

Move user administration CRUD into a standalone Users application path while keeping login, session, token, and middleware behavior inside Auth.

## Key Insights

- Users and Auth are currently coupled because Users reaches into `auth.service.ts` for role lookup behavior.
- The migration target is the user administration path only, not session or credential flow.
- Validation rules already exist and should be preserved exactly rather than redesigned.

## Requirements

- Functional:
  - Preserve list, detail, create, update, and delete route contracts.
  - Preserve duplicate-role rejection, missing-event rejection, password confirmation behavior, self-delete protection, and last-global-admin protection.
  - Keep Auth route behavior unchanged.
- Non-functional:
  - Users no longer depends on Auth internals for role lookup.
  - Auth remains framework-coupled and out of scope for migration.

## Architecture

- `api/users/*.routes.ts` keeps request parsing, auth checks, and response shaping.
- `application/use-cases/users/*` owns user admin workflows.
- `application/interfaces/user-repository.ts` owns user, role, and event existence operations.
- `infrastructure/adapters/users/sqlite-user-repository.ts` owns DB access.

## Related Code Files

- Modify:
  - `src/bun/server/api/users/users.routes.ts`
  - `src/bun/server/api/users/users.service.ts`
  - `src/bun/server/api/auth/auth.service.ts`
- Create:
  - `src/bun/server/application/dtos/users/index.ts`
  - `src/bun/server/application/interfaces/user-repository.ts`
  - `src/bun/server/application/use-cases/users/index.ts`
  - `src/bun/server/application/use-cases/users/list-users.ts`
  - `src/bun/server/application/use-cases/users/get-user-with-roles.ts`
  - `src/bun/server/application/use-cases/users/create-user-account.ts`
  - `src/bun/server/application/use-cases/users/update-user-account.ts`
  - `src/bun/server/application/use-cases/users/delete-user-account.ts`
  - `src/bun/server/infrastructure/adapters/users/sqlite-user-repository.ts`
- Delete:
  - `src/bun/server/api/users/users.service.ts`

## Implementation Steps

1. Add parity tests for all user admin routes and validation rules.
2. Extract user DTOs and role projections.
3. Define `UserRepository` around user, role, event-existence, and last-admin checks.
4. Implement Users use-cases and SQLite adapter.
5. Remove the Users dependency on `auth.service.ts` by moving role lookup into the new repository path.
6. Rewire routes to use the new application layer and delete the legacy service wrapper.

## Todo List

- [ ] User admin parity tests cover all current validation rules.
- [ ] Users no longer imports Auth internals for role lookup.
- [ ] Last-global-admin protection is preserved.
- [ ] Legacy users service is removed.

## Success Criteria

- User admin behavior remains unchanged.
- Auth still handles login and session concerns.
- Users has a clean repository and use-case boundary.

## Risk Assessment

- Primary risk is accidentally shifting validation behavior while decoupling from Auth.
- Secondary risk is widening or narrowing delete protections.

## Security Considerations

- Preserve current auth and authorization on user admin routes.
- Treat password updates and confirmations with the same validation flow as today.

## Next Steps

- After Users is stable, align Display lightly and leave Auth alone unless a later Better Auth migration is planned.
