# Context

## Goal
Production-ready Dahua adapter in TypeScript for Device Service (DS), with resilient buffering and backfill.

## Current Architecture
- DS lease (register/heartbeat) is source of truth for assigned devices.
- Realtime ingestion is **push-based** from terminal:
  - `POST /ingest/event` (`EventHttpUpload`, JSON)
  - `POST /ingest/image-event` (`PictureHttpUpload`, multipart)
- Supported realtime code: `AccessControl` (exactly this in v2).
- Local queue: SQLite WAL, dedupe by `(deviceId, eventId)`.
- Delivery loop retries to DS; DS restart/inactive lease triggers auto re-register.

## Event Model
- Outbound adapter event to DS:
  - `eventId`
  - `deviceId`
  - `direction` (from DS lease assignment)
  - `occurredAt`
  - `terminalPersonId`
  - `rawPayload`
- adapter never computes direction locally; it always uses DS lease direction.
- Primary idempotency strategy:
  - `eventId = accesscontrol-recno-<RecNo>` when available
  - deterministic hash fallback when `RecNo` absent

## Security
- Push endpoints require:
  - HTTP Digest auth (adapter challenges and validates)
- Backfill/identity endpoints use Bearer token.
- DS transport uses Bearer + HMAC.

## Backfill
- DS calls `POST /events/backfill`.
- Adapter returns local queue events first, then queries Dahua:
  - `recordFinder.cgi?action=find&name=AccessControlCardRec`
- Remote rows are mapped to same event-id model to dedupe with realtime.

## Identity Find
- Endpoint: `POST /identity/find`.
- Mode: exact match only.
- Uses settings-driven mapping and Dahua `AccessUser` + `AccessCard` pipeline.

## Monitoring
- `GET /metrics` (Prometheus text)
- `GET /monitor/snapshot`
- `POST /monitor/devices`
- All JSON APIs return envelope `{success,data}` / `{success:false,error}`.

## Dev Mock Mode
- Enabled only when:
  - `NODE_ENV=development`
  - `MOCK_ENABLED=true`
- In-process mock emitter generates AccessControl bursts per assigned device:
  - every 30s
  - 2-3 events
  - 2s intra-burst spacing
- Person source: `mock/persons.json`

## API References Used (DahuaAPI.pdf)
- 4.13.1-4.13.4: Event/Picture HTTP uploading
- 12.1.9: `[Event] AccessControl`
- 12.1.7: `recordFinder` AccessControl record query

- Decision: AccessControl dedup identity is minimal: event type + event timestamp (RealUTC/UTC/CreateTime; fallback occurredAt sec) + UserID.

- Backlog file introduced: dahua-adapter/todo-backlog.md. Focus: split server.ts, shared parse/env/envelope helpers, identity enrichment, user export route, on-demand photo strategy.

- Architecture update: buildServer is composition root; routes split into monitor/ingest/internal modules. Shared helpers added: shared/parse.ts, shared/env-parse.ts, http/http-envelope.ts, http/http-auth.ts.
- Identity API update: /identity/find now may return displayName/source/userType. New admin route: POST /identity/export-users (bearer auth).
- Delivery path update: queue delivery moved to app/delivery/delivery-service.ts; runtime orchestrates timers/lease only.
