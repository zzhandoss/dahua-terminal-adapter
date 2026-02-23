# Dahua Adapter

TypeScript adapter for Dahua terminals with Device Service (DS) as source of truth.

## What It Does

- Registers in DS and keeps lease via heartbeat.
- Receives Dahua push events:
  - `POST /ingest/event` (`EventHttpUpload`)
  - `POST /ingest/image-event` (`PictureHttpUpload`)
- Normalizes `AccessControl` events to DS adapter event schema:
  - `eventId`
  - `deviceId`
  - `direction` (from DS lease assignment)
  - `occurredAt`
  - `terminalPersonId`
  - `rawPayload`
- Buffers events in local SQLite queue and retries delivery to DS.
- Supports DS pull backfill via `POST /events/backfill`.
- Supports identity lookup via `POST /identity/find` (exact match, enriched metadata).
- Supports user export via `POST /identity/export-users`.
- Exposes monitoring:
  - `GET /metrics`
  - `GET /monitor/snapshot`
  - `POST /monitor/devices`

## Security

Push ingest endpoints require:

- HTTP Digest auth (server challenge/verify)

Backfill/identity admin endpoints require:

- `Authorization: Bearer <BACKFILL_BEARER_TOKEN>`

## API Envelope

All JSON endpoints return:

- success: `{ "success": true, "data": ... }`
- error: `{ "success": false, "error": { "code": "...", "message": "...", "data"?: ... } }`

## Device Settings (`settingsJson`)

DS sends `settingsJson` per assigned device. Required shape:

```json
{
  "protocol": "http",
  "host": "192.168.1.100",
  "port": 80,
  "username": "admin",
  "password": "secret",
  "pushAuth": {
    "username": "adapter_push_user",
    "password": "adapter_push_pass"
  },
  "channel": 0,
  "eventCodes": ["AccessControl"],
  "recordBackfillEnabled": true,
  "backfillLookbackHours": 24,
  "backfillQueryLimit": 300,
  "timePolicy": {
    "mode": "boundedDevice",
    "maxDriftMs": 60000
  },
  "identityQueryMappings": {
    "terminalPersonId": {
      "provider": "dahua.accessControlIdentity",
      "sources": ["accessUser", "accessCard"],
      "paramsTemplate": {
        "accessUser.Condition.UserID": "{{identityValue}}",
        "accessCard.Condition.UserID": "{{identityValue}}"
      }
    }
  }
}
```

Exact match is performed only against `paramsTemplate` fields that include `{{identityValue}}`.

`direction` is owned by DS assignment and echoed from lease in adapter payload.

## Backfill

- Source: `recordFinder.cgi?action=find&name=AccessControlCardRec`
- Event id strategy: deterministic hash by `AccessControl + RealUTC/UTC/CreateTime + UserID`
- Dedup key: `deviceId + eventId`

## Mock Mode (Dev Only)

Enable:

- `NODE_ENV=development`
- `MOCK_ENABLED=true`

Behavior:

- For assigned devices with `mockEnabled !== false`, adapter emits synthetic `AccessControl` events in-process.
- Default burst profile:
  - every 30s
  - 2-3 events per burst
  - 2s between events
- Person data source: `mock/persons.json`

## Environment

See `.env.example`. New push-related vars:

- `PUSH_DIGEST_REALM`
- `PUSH_DIGEST_NONCE_TTL_MS`

## Commands

```bash
pnpm --dir dahua-adapter run typecheck
pnpm --dir dahua-adapter run lint
pnpm --dir dahua-adapter run test
pnpm --dir dahua-adapter run build
pnpm --dir dahua-adapter run dev
```

## Production Release

Release artifacts are produced from Git tag `vX.Y.Z` in GitHub Actions:

- `dahua-adapter-vX.Y.Z-source.zip`
- `dahua-adapter-vX.Y.Z-win-x64.zip`
- `dahua-adapter-vX.Y.Z-linux-x64.zip`
- `dahua-adapter-vX.Y.Z-SHA256SUMS.txt`

Release and deployment docs:

- `docs/release/RELEASE.md`
- `docs/release/ARTIFACTS.md`
- `docs/release/INSTALL-linux.md`
- `docs/release/INSTALL-windows.md`

## Dev UI

In development mode (`NODE_ENV=development`) adapter exposes:

- `GET /dev/ui` - browser UI for quick manual testing
- `POST /dev/ui/emit-access-event` - helper endpoint used by the UI

Use it to:

- inspect live snapshot (`/monitor/snapshot`)
- manually emit `AccessControl` events into adapter queue
- verify end-to-end delivery to DS without real terminal traffic
