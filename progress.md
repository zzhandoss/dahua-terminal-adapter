# Progress

## Completed
- Reworked adapter flow from FaceRecognition polling to **AccessControl push ingestion**.
- Added inbound routes:
  - `POST /ingest/event`
  - `POST /ingest/image-event`
- Implemented push security:
  - server-side HTTP Digest challenge/validation
  - ingest authorization by device username/password only (Digest)
- Unified API response envelope for adapter server:
  - `{ success: true, data }`
  - `{ success: false, error }`
- Replaced event normalization strategy with `AccessControlStrategy`.
- Introduced access normalization helper with stable id generation:
  - `accesscontrol-recno-<RecNo>` + hash fallback.
- Updated event contract to DS:
  - `direction` is emitted and strictly sourced from DS lease assignment.
- Migrated SQLite schema and queries to keep `direction` in local queue.
- Implemented RecordFinder backfill:
  - source `AccessControlCardRec`
  - merge with local queue
  - strict `sinceEventId` filtering by RecNo.
- Updated Dahua client:
  - added `findAccessControlRecords`
  - added `findAccessUsers` and `findAccessCards` for identity lookup flow.
- Updated `deviceSettingsSchema` to v2.1:
  - `eventCodes=["AccessControl"]`
  - required `pushAuth`
  - `recordBackfillEnabled`, `backfillLookbackHours`, `backfillQueryLimit`
  - identity mapping moved to `dahua.accessControlIdentity` with `sources` pipeline.
- Added monitoring routes:
  - `GET /metrics`
  - `GET /monitor/snapshot`
  - `POST /monitor/devices`
- Added development UI for manual real-software verification:
  - `GET /dev/ui`
  - `POST /dev/ui/emit-access-event`
- Added in-process dev mock push emitter for assigned devices (`MOCK_ENABLED=true`).
- Updated `.env.example` with push digest settings.
- Updated documentation (`README.md`, `context.md`) to new flow.

## Test Status
- `typecheck`: passed
- `lint`: passed
- `test`: passed (`34` tests)

## Current State
- Adapter is now push-first AccessControl implementation with local durability, DS retry/re-register recovery, RecordFinder backfill, access-identity lookup (AccessUser/AccessCard), and observability endpoints.

## Next Suggested Hardening
- Add tests for `/ingest/image-event` multipart parsing edge-cases.
- Add explicit duplicate-RecNo regression test across realtime + backfill merge path.

- 2026-02-16: AccessControl eventId simplified to hash(type + RealUTC/UTC/CreateTime + UserID). RecNo excluded.

- 2026-02-16: Completed maintainability scan; created prioritized backlog in todo-backlog.md (refactors + requested feature ideas).

- 2026-02-16: Completed backlog items 1-6. Refactored HTTP into route modules/helpers, unified parse/env helpers, extracted DeliveryService, added identity enrichment + /identity/export-users, switched dev-ui to shared envelopes, removed dead event-id util. typecheck/test green (38 tests).
