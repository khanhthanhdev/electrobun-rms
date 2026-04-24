# Local App Pull / Push API

## Status

- Status: implemented
- Audience: local app developers, operators, and maintainers
- Local app HTTP base path: `/api`
- Preferred remote machine namespace: `/api/sync/v1`
- Related deep spec: [sync-api-spec.md](./sync-api-spec.md)

## Purpose

This document describes sync from the local app point of view.

There are two distinct API surfaces:

1. local app admin endpoints used by the React UI and operators
2. remote machine endpoints the local app calls on NRC Web

The existing [sync-api-spec.md](./sync-api-spec.md) already documents the full machine wire contract. This document focuses on how the local app uses that contract, what endpoints it exposes locally, and how outbound push behaves in production.

## Flow Summary

### Pull

`Sync Event` page -> local app admin API -> remote `GET /api/sync/v1/machine/bootstrap` -> local event + outbound link created

### Push

local event data changes -> local outbound queue -> remote `POST /api/sync/v1/machine/push`

## Endpoint Summary

### Local app admin endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/sync/config/nrc-web-base-url` | global admin session token | Read stored remote base URL |
| `POST` | `/api/sync/config/nrc-web-base-url` | global admin session token | Persist remote base URL |
| `POST` | `/api/sync/bootstrap-event` | global admin session token | Pull bootstrap data from NRC Web and create local event |
| `GET` | `/api/sync/admin/seasons/2025/events/:eventCode/outbound-status` | event admin session token | Inspect outbound queue state |
| `POST` | `/api/sync/admin/seasons/2025/events/:eventCode/outbound-retry` | event admin session token | Enqueue an immediate outbound snapshot batch |

### Remote machine endpoints used by the local app

| Method | Path | Auth | Used for |
| --- | --- | --- | --- |
| `GET` | `<remoteBaseUrl>/api/sync/v1/machine/bootstrap` | `Authorization: Bearer <machine secret>` | Initial pull/bootstrap |
| `POST` | `<remoteBaseUrl>/api/sync/v1/machine/push` | `Authorization: Bearer <machine secret>` | Outbound snapshot/upsert push |

## Pull API

## 1. Read stored NRC Web base URL

- Method: `GET`
- Path: `/api/sync/config/nrc-web-base-url`
- Auth: global admin
- Response:

```json
{
  "baseUrl": "http://localhost:3001"
}
```

Notes:

- Returns `{ "baseUrl": undefined }` when not configured.
- Used by the sync page to prefill the base URL field.

## 2. Store NRC Web base URL

- Method: `POST`
- Path: `/api/sync/config/nrc-web-base-url`
- Auth: global admin
- Request body:

```json
{
  "baseUrl": "http://localhost:3001"
}
```

- Success response:

```json
{
  "baseUrl": "http://localhost:3001",
  "success": true
}
```

Validation and behavior:

- `baseUrl` is required.
- Must be an absolute `http` or `https` URL.
- Trailing slashes are removed before storing.

## 3. Bootstrap a local event from NRC Web

- Method: `POST`
- Path: `/api/sync/bootstrap-event`
- Auth: global admin
- Request body:

```json
{
  "baseUrl": "http://localhost:3001",
  "eventCode": "nrc2026",
  "eventKey": "<remote machine bearer secret>"
}
```

Request field meanings:

- `baseUrl`
  - optional if already stored in config
  - when provided, it replaces the stored base URL before bootstrap runs
- `eventCode`
  - required local event code
  - normalized and validated by the local app
  - must be 1 to 8 alphanumeric characters
- `eventKey`
  - required
  - despite the name, this is the remote machine bearer secret copied from NRC Web

Success response:

```json
{
  "success": true,
  "eventCode": "nrc2026",
  "redirectUrl": "/event/nrc2026/dashboard/defaultaccounts"
}
```

What the local app does internally:

1. resolves the remote base URL from the request or stored config
2. calls remote `GET /api/sync/v1/machine/bootstrap` with `Authorization: Bearer <eventKey>`
3. validates the bootstrap response against the machine schema
4. creates the local event shell
5. seeds local teams from approved registrations and team operational profiles
6. stores an outbound link record containing:
   - remote base URL
   - remote bearer secret
   - remote event key
   - allowed pull resources
   - allowed push resources
   - sync review mode
   - schedule owner
   - definition version

Failure cases surfaced by the local app:

- `400 VALIDATION_FAILED`
  - missing or invalid `baseUrl`
  - missing `eventCode`
  - invalid local event code
  - missing `eventKey`
- `401 UNAUTHORIZED`
  - remote bearer secret rejected by NRC Web
- `404 NOT_FOUND`
  - remote bootstrap endpoint missing
- `500 NETWORK_ERROR`
  - remote host unreachable
- `500 PARSE_ERROR`
  - remote returned non-JSON
- `500 SCHEMA_MISMATCH`
  - remote returned incompatible bootstrap data
- `500 REMOTE_ERROR`
  - any other remote bootstrap failure

## Remote bootstrap request made by the local app

The local app issues this request during bootstrap:

```http
GET /api/sync/v1/machine/bootstrap
Authorization: Bearer <machine secret>
Accept: application/json
```

The response body is the `EventBootstrapResponse` described in [sync-api-spec.md](./sync-api-spec.md).

The local app currently consumes these pulled resources:

- `season_definition`
- `event_manifest`
- `approved_registrations`
- `team_operational_profiles`
- `sync_policy`

## Push API

## 1. Read outbound sync status

- Method: `GET`
- Path: `/api/sync/admin/seasons/2025/events/:eventCode/outbound-status`
- Auth: event admin for `:eventCode`
- Success response:

```json
{
  "eventCode": "nrc2026",
  "hasOutboundLink": true,
  "isSyncEnabled": true,
  "paused": false,
  "counts": {
    "blocked": 0,
    "failed": 1,
    "in_flight": 0,
    "pending_review": 0,
    "queued": 2,
    "succeeded": 5
  },
  "backoffUntil": "2026-04-18T02:14:23.000Z",
  "lastAttemptAt": "2026-04-18T02:09:23.000Z",
  "lastSuccessAt": "2026-04-18T02:08:54.000Z",
  "lastError": "Remote push failed with HTTP 503."
}
```

Field meanings:

- `hasOutboundLink`: local app has remote sync credentials and metadata
- `isSyncEnabled`: sync policy allows outbound push
- `paused`: local queue is paused
- `counts`: totals by local outbound batch status
- `backoffUntil`: next retry time when retryable failures are backing off
- `lastAttemptAt`: last send attempt
- `lastSuccessAt`: last successful send
- `lastError`: last terminal or retryable error message

## 2. Queue an immediate outbound retry

- Method: `POST`
- Path: `/api/sync/admin/seasons/2025/events/:eventCode/outbound-retry`
- Auth: event admin for `:eventCode`
- Request body: `{}` is accepted; body content is ignored
- Success response:

```json
{
  "batchId": "7fb905d7-5df7-47b6-aadb-9fca5dfdb123",
  "eventCode": "nrc2026",
  "success": true
}
```

Behavior:

- Cancels any pending debounce timer for the same event.
- Builds a fresh outbound snapshot batch immediately.
- Fails if no outbound link exists.
- Fails if sync is disabled for the event.

## Automatic push behavior

The local app does not expose a generic `POST /api/sync/push` endpoint for callers.

Instead, push is driven by the server-side `OutboundSyncPushService`:

- event writes call `requestEventSync(eventCode)`
- requests are debounced for `1500ms`
- a batch is stored locally with status `queued`
- a background worker checks for due batches every `1000ms`
- each due batch is sent to remote `POST /api/sync/v1/machine/push`

## Remote push request made by the local app

The local app sends:

```http
POST /api/sync/v1/machine/push
Authorization: Bearer <machine secret>
Content-Type: application/json
Accept: application/json
```

Request body shape:

```json
{
  "schemaVersion": "2026-03-08",
  "definitionVersion": "2025.1",
  "batchId": "<uuid>",
  "producedAt": "<iso timestamp>",
  "source": {
    "appVersion": "<string>",
    "deviceId": "<optional>",
    "databaseId": "<optional>"
  },
  "resources": [
    {
      "resourceType": "match_results",
      "mode": "upsert",
      "schemaRef": "<optional>",
      "records": []
    }
  ]
}
```

Current outbound resource types:

- `inspection_schedule` with `replace_snapshot`
- `inspection_results` with `upsert`
- `match_schedule` with `replace_snapshot`
- `match_results` with `upsert`
- `team_rankings` with `replace_snapshot`
- `team_awards` with `replace_snapshot`

Payload generation notes:

- allowed resources are the intersection of:
  - what the outbound link allows
  - what the current sync policy allows
- the payload is built from local event state at enqueue time
- `replace_snapshot` resources must contain the full intended state
- `upsert` resources contain only records the local app wants to submit

For full resource record schemas, use [sync-api-spec.md](./sync-api-spec.md).

## Outbound batch lifecycle

Local batch statuses:

| Local status | Meaning |
| --- | --- |
| `queued` | waiting to be processed |
| `in_flight` | HTTP request is in progress |
| `succeeded` | remote returned `applied` or `duplicate` |
| `pending_review` | remote returned `pending_review` |
| `failed` | retryable failure; batch will retry after backoff |
| `blocked` | non-retryable failure; manual intervention required |

Retry behavior:

- retryable HTTP statuses: `408`, `425`, `429`, `500`, `502`, `503`, `504`
- `409` is retryable unless the remote error code is `BATCH_HASH_MISMATCH`
- network errors are retryable
- backoff uses exponential growth capped at `300000ms` plus jitter

Remote outcomes are mapped like this:

| Remote result | Local result |
| --- | --- |
| `200` with `status: "applied"` | `succeeded` |
| `200` with `status: "duplicate"` | `succeeded` |
| `200` with `status: "pending_review"` | `pending_review` |
| retryable HTTP failure | `failed` |
| non-retryable HTTP failure | `blocked` |
| local config/link missing | `blocked` |

## Important implementation notes

- The server mounts `syncRoutes` at both `/api/sync` and `/api/sync/v1`.
- The React app currently calls local admin routes through `/api/sync/...`.
- The local app always calls the remote machine contract through `/api/sync/v1/...`.
- The UI label `eventKey` is misleading. It is the remote machine bearer secret, not the canonical remote `season/eventCode` key.
- A successful bootstrap stores the remote bearer secret locally so future outbound pushes can run without user interaction.

## Minimal operator sequence

1. Open `/sync/event` in the local app.
2. Confirm or enter NRC Web base URL.
3. Paste the remote machine bearer secret into the `eventKey` field.
4. Enter the local event code.
5. Submit bootstrap.
6. Verify outbound status shows:
   - `hasOutboundLink: true`
   - `isSyncEnabled: true`
7. If pushes stall, inspect `lastError` and use outbound retry.

## Unresolved questions

- The request field name `eventKey` should likely be renamed to `bearerSecret` or `machineSecret` in a future cleanup to match actual behavior.
