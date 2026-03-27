# Phase 3: Migrate Print Lists Domain

**Status:** Pending
**Priority:** Medium
**Effort:** 1-2 hours

## Overview

Migrate print lists generation from legacy service to use-case with repository pattern.

## Key Insights

- Use-case exists: `ListEventPrintListsUseCase`
- Interface exists: `EventPrintListsService`
- Legacy implementation: `event-print-lists-service.ts` (8KB)
- Print list generation logic includes:
  - Schedule PDF generation
  - Rankings PDF generation
  - Team lists PDF generation

## Files to Create

| File | Purpose |
|------|---------|
| `src/bun/server/infrastructure/adapters/events/sqlite-event-print-lists-service.ts` | Service implementation |

## Files to Modify

| File | Change |
|------|--------|
| `src/bun/server/application/use-cases/events/list-event-print-lists.ts` | Use concrete implementation |
| `src/bun/server/api/events/events.routes.ts` | Wire up use-case if not already |

## Implementation Steps

### Step 1: Move Logic to Repository

Copy logic from `services/event-print-lists-service.ts` into:

```typescript
// src/bun/server/infrastructure/adapters/events/sqlite-event-print-lists-service.ts
import { Database } from "bun:sqlite";
import type { EventPrintListsService } from "../../application/interfaces/event-print-lists-service";

export class SQLiteEventPrintListsService implements EventPrintListsService {
  // Move all print list generation methods here
  // - generatePracticeSchedulePdf()
  // - generateQualificationSchedulePdf()
  // - generateRankingsPdf()
  // - generateTeamListPdf()
}
```

### Step 2: Update Use-Case

```typescript
// application/use-cases/events/list-event-print-lists.ts
import { SQLiteEventPrintListsService } from "../../infrastructure/adapters/events";

export class ListEventPrintListsUseCase {
  constructor(
    private readonly printListsService: EventPrintListsService
  ) {}

  async execute(command: ListEventPrintListsCommand) {
    return this.printListsService.generate(command.eventCode, command.listType);
  }
}
```

### Step 3: Update Events Routes

Wire up the use-case if not already done:

```typescript
// src/bun/server/api/events/events.routes.ts
const printListsService = new SQLiteEventPrintListsService();
const listEventPrintListsUseCase = new ListEventPrintListsUseCase(printListsService);
```

## Success Criteria

- [ ] `event-print-lists-service.ts` deleted
- [ ] Print list generation works unchanged
- [ ] PDF output identical to before

## Dependencies

- None - independent phase
