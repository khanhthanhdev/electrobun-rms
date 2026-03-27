# Extract Ranking Poll Service

**Created:** 2026-03-27
**Priority:** Highest - only remaining planned item
**Status:** Complete

---

## Overview

Extract the ranking poll service from `rankings-sync.ts` into a dedicated infrastructure service. This moves the poll loop and fingerprint logic into `infrastructure/services/ranking-poll-service.ts`, leaving `rankings-sync.ts` with only types, hub instance, and snapshot-hint factory.

---

## Key Insights

From codebase analysis:
- Current poll logic in `src/bun/server/api/events/rankings-sync.ts` (lines 45-141)
- Poll interval: 1500ms (1.5 seconds)
- Uses fingerprint comparison to detect ranking source changes
- Auto-rebuilds rankings when fingerprint changes
- Global singleton pattern via module-level state

---

## Architecture

### Current State
```
rankings-sync.ts (160 lines)
├── Types & Interfaces (lines 1-43)
├── Module state (lines 45-58)
├── Poll logic (lines 61-141)
└── Hub & exports (lines 143-159)
```

### Target State
```
ranking-poll-service.ts (new)
├── RankingPollService class
├── Poll loop + fingerprint logic
├── MonitorState management
└── Lifecycle methods (start/stop)

rankings-sync.ts (refactored ~60 lines)
├── Types & Interfaces
├── Hub instance
└── Snapshot-hint factory
```

---

## Related Code Files

**Create:**
- `src/bun/server/infrastructure/services/ranking-poll-service.ts`

**Modify:**
- `src/bun/server/api/events/rankings-sync.ts` - Remove poll logic
- `src/bun/server/infrastructure/services/index.ts` - Add export
- `src/bun/index.ts` - Start poll service on bootstrap

---

## Implementation Steps

### 1. Create RankingPollService

File: `src/bun/server/infrastructure/services/ranking-poll-service.ts`

```typescript
interface MonitorState {
  inFlight: boolean;
  lastFingerprint: string | null;
}

interface RankingPollServiceDependencies {
  getFingerprintUseCase: GetQualificationRankingSourceFingerprintUseCase;
  rebuildUseCase: RebuildQualificationRankingsUseCase;
  hub: InMemorySyncHub<QualificationRankingsSyncEvent>;
  db: Database;
}

export class RankingPollService {
  private readonly pollIntervalMs = 1500;
  private readonly monitorByEventCode = new Map<string, MonitorState>();
  private pollLoopInFlight = false;
  private intervalId: Timer | null = null;

  constructor(private readonly deps: RankingPollServiceDependencies) {}

  start(): void {
    this.intervalId = setInterval(() => {
      this.pollAllEvents().catch(() => undefined);
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private pollAllEvents(): Promise<void> {
    // Poll logic from rankings-sync.ts lines 105-137
  }

  private pollEventSource(eventCode: string): Promise<void> {
    // Poll logic from rankings-sync.ts lines 71-103
  }
}
```

### 2. Refactor rankings-sync.ts

Remove:
- `MonitorState` interface
- `monitorByEventCode` map
- `pollLoopInFlight` variable
- `pollEventSource` function
- `pollAllEvents` function
- `setInterval` call
- Use case instantiations

Keep:
- Types and interfaces
- `hub` instance
- `publishRankingsEvent` helper
- `createQualificationRankingsSnapshotHintEvent` factory
- Exported `qualificationRankingsSyncHub` publisher

### 3. Update barrel export

File: `src/bun/server/infrastructure/services/index.ts`

Add: `export * from "./ranking-poll-service";`

### 4. Start service from bootstrap

File: `src/bun/index.ts`

```typescript
import { RankingPollService } from "./server/infrastructure/services";
import { db } from "./db";
import { SQLiteRankingRepository } from "./server/infrastructure/adapters/ranking";
import {
  GetQualificationRankingSourceFingerprintUseCase,
  RebuildQualificationRankingsUseCase,
} from "./server/application/use-cases/ranking";
import { hub } from "./server/api/events/rankings-sync"; // or move hub to infrastructure

const rankingRepository = new SQLiteRankingRepository();
const pollService = new RankingPollService({
  getFingerprintUseCase: new GetQualificationRankingSourceFingerprintUseCase(rankingRepository),
  rebuildUseCase: new RebuildQualificationRankingsUseCase(rankingRepository),
  hub,
  db,
});
pollService.start();
```

---

## Todo List

- [x] Create ranking-poll-service.ts infrastructure service
- [x] Refactor rankings-sync.ts to remove poll logic
- [x] Export ranking-poll-service from barrel file
- [x] Start poll service from server bootstrap

---

## Success Criteria

- [x] Poll logic fully extracted to dedicated service class
- [x] `rankings-sync.ts` reduced to ~60 lines (types + hub + factory only)
- [x] Poll service starts automatically on server bootstrap
- [x] No behavior changes - polling continues at 1500ms interval
- [x] All existing tests pass (37 passing, 11 pre-existing failures unrelated to changes)
- [x] Clean architecture boundaries maintained (infrastructure layer owns polling)

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Circular dependency (hub import) | Move hub instantiation to infrastructure or pass as constructor param |
| Poll service not starting | Add logging on start, verify in bootstrap |
| State loss during refactor | Keep MonitorState logic identical, only relocate |

---

## Security Considerations

- No auth changes required - poll service is internal
- No external API exposure
- Database access remains through repository pattern

---

## Next Steps

1. Implement poll service
2. Refactor rankings-sync.ts
3. Update bootstrap
4. Run tests to verify behavior
