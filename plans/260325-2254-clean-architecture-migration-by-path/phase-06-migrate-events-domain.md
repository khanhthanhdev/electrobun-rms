# Phase 06: Migrate Events Domain

**Parent Plan:** `./plan.md`
**Priority:** 6
**Status:** Completed
**Effort:** 3-5 hours

## Context Links

- Parent path plan: [plan.md](./plan.md)
- Current events routes: `src/bun/server/api/events/events.routes.ts`
- Current events service: `src/bun/server/api/events/events.service.ts`
- Current manual-event logic: `src/bun/server/services/manual-event-service.ts`
- Current print list service: `src/bun/server/services/event-print-lists-service.ts`

## Overview

Split Events into core event CRUD plus infrastructure-backed provisioning and reporting. Ranking operations stay on the same `/events` URLs but move to the Ranking path internally.

## Key Insights

- `api/events/events.service.ts` currently mixes event CRUD, ranking delegation, default account regeneration, and print-list generation.
- `manual-event-service.ts` is both a useful infrastructure candidate and the current home of `ServiceError`, so the migration should decouple those concerns.
- Events should orchestrate infrastructure services, not own their internals.

## Requirements

- Functional:
  - Preserve event list, get, update, manual create, default account, and print-list route contracts.
  - Keep ranking endpoints on the same `/events` route surface while delegating them to the Ranking path.
  - Preserve event provisioning side effects and default-account regeneration behavior.
- Non-functional:
  - Event CRUD lives behind `EventRepository`.
  - Provisioning and print-list generation stay in infrastructure services.
  - Cross-domain error handling moves toward `ApplicationError`.

## Architecture

- `api/events/*.routes.ts` keeps request parsing and auth.
- `application/use-cases/events/*` owns event CRUD and orchestration of infrastructure-backed work.
- `application/interfaces/event-repository.ts` owns event persistence.
- `infrastructure/adapters/events/sqlite-event-repository.ts` owns DB access.
- `infrastructure/services/*` hosts manual event creation, default account regeneration, and print-list generation.

## Related Code Files

- Modify:
  - `src/bun/server/api/events/events.routes.ts`
  - `src/bun/server/api/events/events.service.ts`
  - `src/bun/server/services/manual-event-service.ts`
  - `src/bun/server/services/event-print-lists-service.ts`
- Create:
  - `src/bun/server/application/dtos/events/index.ts`
  - `src/bun/server/application/interfaces/event-repository.ts`
  - `src/bun/server/application/use-cases/events/index.ts`
  - `src/bun/server/application/use-cases/events/list-events.ts`
  - `src/bun/server/application/use-cases/events/get-event.ts`
  - `src/bun/server/application/use-cases/events/update-event.ts`
  - `src/bun/server/application/use-cases/events/create-manual-event.ts`
  - `src/bun/server/application/use-cases/events/regenerate-default-accounts.ts`
  - `src/bun/server/infrastructure/adapters/events/sqlite-event-repository.ts`
- Delete:
  - `src/bun/server/api/events/events.service.ts`

## Implementation Steps

1. Add parity tests for event CRUD, manual event creation, default-account regeneration, and print-list routes.
2. Extract event DTOs and repository contract.
3. Implement Events use-cases for list, get, update, manual create, and default-account regeneration.
4. Move event persistence into the SQLite adapter.
5. Treat manual-event and print-list logic as infrastructure services invoked by use-cases.
6. Remove ranking-specific logic from Events internals and delegate to Ranking use-cases while keeping current URLs.
7. Delete the events service wrapper after verification.

## Todo List

- [ ] Event CRUD uses `EventRepository`.
- [ ] Manual event creation is orchestrated from application code.
- [ ] Print-list generation remains available through infrastructure services.
- [ ] Ranking logic is no longer inside Events service code.

## Success Criteria

- Event route contracts stay unchanged.
- Event provisioning side effects remain unchanged.
- Events becomes a coordinator instead of a mixed business and infrastructure service.

## Risk Assessment

- Provisioning is the main risk because side effects span DB creation, user bootstrap, and filesystem work.
- Ranking leakage back into Events is a medium architectural risk.

## Security Considerations

- Preserve admin-only protections on event mutation routes.
- Keep default-account regeneration restricted exactly as it is today.

## Next Steps

- Users migration should follow after Events so event existence checks and event-bound validation already have a clean repository path.
