# TODO Backlog (Maintainability + Next Features)

## P0 - Refactor for maintainability

### 1) Decompose `http/server.ts` into route modules and shared responders
Problem:
- `src/http/server.ts` combines route registration, auth, parsing, ingest flow, envelope formatting, CORS and logger setup in one file.
- Current size makes changes risky and slows feature work.

Actions:
- Split route registration into:
  - `src/http/routes/ingest-routes.ts`
  - `src/http/routes/monitor-routes.ts`
  - `src/http/routes/internal-routes.ts` (`/events/backfill`, `/identity/find`)
- Move envelope builders to shared helper:
  - `src/http/http-envelope.ts` (`ok()`, `fail()`)
- Move auth helpers to:
  - `src/http/http-auth.ts` (digest + bearer)
- Move image-event body processing to:
  - `src/http/ingest/image-event-handler.ts`

Benefits:
- Smaller modules, easier test isolation, lower regression risk.

### 2) Unify parsing helpers used in multiple modules
Problem:
- Similar conversion helpers are duplicated (`toInt`, optional string/number parsers, parse JSON safely).
- Implementations live in unrelated files and may drift.

Actions:
- Create `src/shared/parse.ts`:
  - `parseJsonSafe`
  - `toIntOrNull`
  - `toStringOrNull`
  - `toObjectOrNull`
- Reuse in:
  - `src/infra/dahua/parsers/access-control-push.ts`
  - `src/infra/dahua/dahua-client.ts`
  - `src/infra/ds/device-service-client.ts`

Benefits:
- Single behavior contract for parsing and less hidden inconsistency.

### 3) Consolidate boolean/env parsing
Problem:
- `parseBoolean` logic exists in more than one place (`env.ts`, `server.ts`).

Actions:
- Keep one implementation in `src/shared/env-parse.ts` and import everywhere.

Benefits:
- Predictable env behavior and no split-brain defaults.

### 4) Remove dead/unused event id utility or make it canonical
Problem:
- `src/domain/events/event-id.ts` (`buildStableEventId`) is currently unused.

Actions:
- Either:
  - remove file, or
  - migrate `buildAccessEventId` to use it as canonical hash builder.

Benefits:
- Eliminates dead code and confusion around source of truth for event id.

## P1 - Product/API enhancements requested

### 5) Enrich identity search response (name + optional metadata)
Status: requested

Goal:
- `identity/find` should return more than `terminalPersonId`.

Proposal:
- Extend `IdentityFindMatch` payload with optional fields:
  - `displayName` (from `UserName` / `CardName`)
  - `source` (`accessUser` | `accessCard`)
  - `userType` (if available)
- Keep backward compatibility: existing fields unchanged.

Acceptance:
- DS can still consume old fields.
- New fields appear when available.

### 6) New route: export users from a selected device
Status: requested

Goal:
- Endpoint to retrieve users from the specific device with useful profile fields.

Proposal:
- Add route: `POST /identity/export-users`
- Request:
  - `deviceId`
  - pagination/filter input (`limit`, optional `offset`, optional conditions)
- Response:
  - array of normalized user profiles
  - source metadata + paging info

Notes:
- Prefer `AccessUser` as primary source.
- Optionally merge/augment from `AccessCard`.

### 7) On-demand photo strategy (no durable storage)
Status: requested (discovery/design)

Goal:
- Provide person/event photo on demand without persistent file storage.

Options:
- A) Proxy mode (recommended first)
  - Adapter fetches image from device and streams response directly.
  - Optional short in-memory cache (TTL + max size).
- B) Ephemeral cache mode
  - Keep recent blobs in memory only (LRU), no disk.

Design constraints:
- No long-term storage on adapter.
- Explicit size/time limits.
- Backpressure + timeout controls.

## P2 - Additional maintainability improvements

### 8) Extract DS delivery mapping/ack loop from `adapter-runtime.ts`
Problem:
- `deliverPending` mixes queue loading, DTO mapping, DS call, ack decisions, re-register handling and logging.

Actions:
- Create `src/app/delivery/delivery-service.ts`:
  - `buildIngestPayload`
  - `applyAckResults`
  - `shouldAckResult`

Benefits:
- Easier to test retry/ack policy without runtime timers.

### 9) Normalize dev-ui envelopes through shared helper
Problem:
- `src/http/dev-ui.ts` builds envelope objects ad-hoc.

Actions:
- Reuse shared `ok()/fail()` envelope helper from HTTP layer.

Benefits:
- Consistent API shape across all routes.

### 10) Add focused tests for multipart/image-event parser matrix
Problem:
- Multi-format ingestion paths are high-risk and currently concentrated in one route.

Actions:
- Add table-driven tests for:
  - json body
  - `Events[]` envelope
  - multipart with json part
  - multipart with text/plain kv/json
  - heartbeat-only payload

Benefits:
- Safer refactors around ingest without device regressions.
