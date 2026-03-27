# Infrastructure Layer

**Interface Adapters** - Implementations of application interfaces.

## Rules

- **MAY** import from `application/` and `domain/`
- **MUST** implement interfaces defined in `application/interfaces/`
- **MAY** use frameworks, databases, external services

## Contents

| Folder | Purpose |
|--------|---------|
| `adapters/` | Repository implementations (SQLiteScoringRepository) |
| `database/` | Database configuration and utilities |
| `services/` | External service implementations |

## Exports

```typescript
// All exports flow through infrastructure/index.ts
export * from './adapters';
export * from './database';
export * from './services';
```

## Example

```typescript
// infrastructure/adapters/scoring/sqlite-scoring-repository.ts
import { ScoringRepository } from '../../../application/interfaces';

export class SQLiteScoringRepository implements ScoringRepository {
  constructor(private db: Database) {}

  async saveAllianceScore(input: SaveScoreInput) {
    // SQLite-specific implementation
  }
}
```
