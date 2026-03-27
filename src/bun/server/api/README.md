# API Layer

**Frameworks & Drivers** - Outermost layer, HTTP handlers and route definitions.

## Rules

- **MAY** import from `application/` and `infrastructure/`
- **SHOULD** avoid importing directly from `domain/`; prefer the application layer boundary
- **MUST** keep controllers thin - delegate to use-cases
- **MAY** use Hono, middleware, and framework-specific code

## Known Exceptions

- `display/*` intentionally stays in `api/` as a transport bridge. It owns
  `/display/stream`, `/display/command`, and the scoring-to-display SSE
  republish path because there is no display persistence or independent domain
  workflow yet.

## Contents

| Folder | Purpose |
|--------|---------|
| `*/routes.ts` | Hono route definitions |
| `*/controller.ts` | Request handlers (thin layer) |
| `*/schema.ts` | Request/response validation schemas |
| `common/` | Shared HTTP utilities, guards, validation |

## Exports

```typescript
// api/index.ts - main entry point
export { api } from './index';
```

## Dependency Flow

```
HTTP Request
    ↓
api/controller.ts  (parse request, call use-case)
    ↓
application/use-case  (business logic)
    ↓
application/interface  (repository interface)
    ↓
infrastructure/adapter  (database implementation)
    ↓
domain/entity  (business rules)
```

## Example

```typescript
// api/scoring/scoring.controller.ts
export async function submitAllianceScore(c: Context) {
  const input = await c.req.json();
  const useCase = new SubmitAllianceScore(scoringRepository);
  const result = await useCase.execute(input);
  return c.json(result);
}
```
