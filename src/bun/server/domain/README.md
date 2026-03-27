# Domain Layer

**Enterprise Business Rules** - Innermost layer, NO external dependencies.

## Rules

- **MUST NOT** import from `application/`, `infrastructure/`, or `api/`
- **MUST** contain only pure business logic
- **MUST** be framework-agnostic and database-agnostic

## Contents

| Folder | Purpose |
|--------|---------|
| `entities/` | Core business objects (Match, Alliance, Team, Event) |
| `value-objects/` | Immutable domain primitives (MatchId, TeamNumber, AllianceColor) |
| `events/` | Domain events (MatchScoredEvent) |
| `season-rules/` | Season-specific rule implementations |

## Exports

```typescript
// All exports flow through domain/index.ts
export * from './entities';
export * from './value-objects';
export * from './events';
export * from './season-rules';
```

## Example

```typescript
// domain/entities/match.ts
export interface Match {
  id: string;
  number: number;
  type: 'practice' | 'quals' | 'elims';
  redAlliance: Alliance;
  blueAlliance: Alliance;
}
```
