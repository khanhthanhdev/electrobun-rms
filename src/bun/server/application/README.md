# Application Layer

**Application Business Rules** - Use cases that orchestrate domain logic.

## Rules

- **MAY** import from `domain/`
- **MUST NOT** import from `infrastructure/` or `api/`
- **MUST** define interfaces for external concerns (repositories, services)
- **MUST** contain only business logic, no framework code

## Contents

| Folder | Purpose |
|--------|---------|
| `interfaces/` | Repository and service interfaces (Dependency Inversion) |
| `use-cases/` | Business operations (SubmitAllianceScore, ComputeRankings) |
| `dtos/` | Data Transfer Objects for input/output |

## Exports

```typescript
// All exports flow through application/index.ts
export * from './interfaces';
export * from './use-cases';
export * from './dtos';
```

## Example

```typescript
// application/interfaces/scoring-repository.ts
export interface ScoringRepository {
  saveAllianceScore(input: SaveScoreInput): Promise<void>;
  getMatchScoresheet(matchId: string): Promise<MatchScoresheet>;
}

// application/use-cases/scoring/submit-alliance-score.ts
export class SubmitAllianceScore {
  constructor(private scoringRepo: ScoringRepository) {}

  async execute(input: SubmitAllianceScoreDTO) {
    // Business logic only
  }
}
```
