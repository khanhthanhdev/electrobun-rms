# Phase 1: Migrate Rankings Domain

**Status:** Pending
**Priority:** High
**Effort:** 1-2 hours

## Overview

Create API routes for Rankings using existing use-cases and repository interface.
The Rankings domain already has clean architecture components in place - only needs HTTP layer.

## Key Insights

- `RankingRepository` interface exists: `application/interfaces/ranking-repository.ts`
- Use-cases exist: `GetQualificationRankingsUseCase`, `RebuildQualificationRankingsUseCase`
- `SQLiteRankingRepository` implementation exists in `infrastructure/`
- **Missing:** No `/api/ranking/ranking.routes.ts` file to expose use-cases over HTTP

## Files to Create

| File | Purpose |
|------|---------|
| `src/bun/server/api/ranking/ranking.routes.ts` | Hono routes + controllers |
| `src/bun/server/api/ranking/ranking.schema.ts` | Request/response validation schemas |
| `src/bun/server/application/use-cases/ranking/index.ts` | Barrel export for use-cases |

## Files to Modify

| File | Change |
|------|--------|
| `src/bun/server/api/index.ts` | Import and mount ranking routes |

## Implementation Steps

### Step 1: Create Ranking Routes File

```typescript
// src/bun/server/api/ranking/ranking.routes.ts
import { Hono } from "hono";
import { GetQualificationRankingsUseCase } from "../../application/use-cases/ranking";
import { SQLiteRankingRepository } from "../../infrastructure/adapters/ranking";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";

export const rankingRoutes = new Hono<AppEnv>();

const rankingRepository = new SQLiteRankingRepository();
const getQualificationRankingsUseCase = new GetQualificationRankingsUseCase(
  rankingRepository
);

rankingRoutes.get(
  "/:eventCode/ranking/qualifications",
  requireAuth,
  async (c) => {
    const eventCode = c.req.param("eventCode");
    const result = await getQualificationRankingsUseCase.execute({ eventCode });
    return c.json(result);
  }
);
```

### Step 2: Create Schema File (if needed)

Copy pattern from `scoring.routes.ts` for any request validation.

### Step 3: Export Use-Cases

```typescript
// src/bun/server/application/use-cases/ranking/index.ts
export { GetQualificationRankingsUseCase } from "./get-qualification-rankings";
export { RebuildQualificationRankingsUseCase } from "./rebuild-qualification-rankings";
```

### Step 4: Mount Routes in Main Router

```typescript
// src/bun/server/api/index.ts
import { rankingRoutes } from "./ranking/ranking.routes";

const app = new Hono<AppEnv>();
app.route("/api", rankingRoutes);
```

## Success Criteria

- [ ] `bun run build` succeeds
- [ ] GET `/:eventCode/ranking/qualifications` returns JSON response
- [ ] No imports from `services/` directory
- [ ] Routes follow Scoring pattern (thin controllers, use-case injection)

## Security Considerations

- Use `requireAuth` middleware on all ranking endpoints
- No special authorization needed (read-only operation)

## Dependencies

- None - independent phase
