# Identity API for DS/Core

This document describes the adapter endpoints that DS/Core can use to:

- export users from Dahua terminals;
- create users on Dahua terminals;
- update users on Dahua terminals;
- bulk-create users on Dahua terminals;
- read the current face/photo data for a specific user from a specific terminal.

All endpoints below require:

- `Authorization: Bearer <BACKFILL_BEARER_TOKEN>`

All JSON endpoints return the standard adapter envelope:

- success: `{ "success": true, "data": ... }`
- error: `{ "success": false, "error": { "code": "...", "message": "..." } }`

## Target Selection

Identity export/write endpoints use the same `target` contract.

```json
{
  "target": {
    "mode": "device",
    "deviceId": "terminal-1"
  }
}
```

```json
{
  "target": {
    "mode": "devices",
    "deviceIds": ["terminal-1", "terminal-2"]
  }
}
```

```json
{
  "target": {
    "mode": "allAssigned"
  }
}
```

Rules:

- `device`: work with exactly one assigned device.
- `devices`: fan-out to a fixed list of assigned devices.
- `allAssigned`: fan-out to every device currently assigned to this adapter instance.
- If one device is missing or fails, the whole request does not fail by default. The response contains per-device results.

## Export Users

Endpoint:

- `POST /identity/export-users`

Purpose:

- export normalized users from one or more terminals;
- support both DS flows:
  - flat import list;
  - grouped per-device diagnostics/import.

Request:

```json
{
  "target": {
    "mode": "devices",
    "deviceIds": ["terminal-1", "terminal-2"]
  },
  "view": "flat",
  "limit": 100,
  "offset": 0,
  "includeCards": true
}
```

Fields:

- `view`: `"flat"` or `"grouped"`
- `limit`: per-device limit
- `offset`: per-device offset
- `includeCards`: when `true`, enrich export with `AccessCard` data

Notes:

- `AccessUser` is the primary source.
- `AccessCard` is used for enrichment and card-only fallback records.
- pagination is per device, not global across all devices.

### Flat Response

```json
{
  "success": true,
  "data": {
    "view": "flat",
    "users": [
      {
        "deviceId": "terminal-1",
        "terminalPersonId": "100013",
        "displayName": "Ivan Petrov",
        "userType": "0",
        "userStatus": "0",
        "authority": "2",
        "citizenIdNo": "900101000001",
        "validFrom": "2026-03-01 00:00:00",
        "validTo": "2026-12-31 23:59:59",
        "cardNo": "CARD-100013",
        "cardName": "Main card",
        "sourceSummary": ["accessUser", "accessCard"],
        "rawUserPayload": "{\"UserID\":\"100013\"}",
        "rawCardPayload": "{\"CardNo\":\"CARD-100013\"}"
      }
    ],
    "devices": [
      {
        "deviceId": "terminal-1",
        "exportedCount": 1,
        "failed": false,
        "hasMore": false
      },
      {
        "deviceId": "terminal-2",
        "exportedCount": 0,
        "failed": true,
        "errorCode": "identity_export_failed",
        "errorMessage": "cgi status 500: ..."
      }
    ]
  }
}
```

### Grouped Response

```json
{
  "success": true,
  "data": {
    "view": "grouped",
    "devices": [
      {
        "deviceId": "terminal-1",
        "exportedCount": 2,
        "failed": false,
        "hasMore": false,
        "users": [
          {
            "deviceId": "terminal-1",
            "terminalPersonId": "100013",
            "displayName": "Ivan Petrov",
            "userType": "0",
            "userStatus": "0",
            "authority": "2",
            "citizenIdNo": "900101000001",
            "validFrom": null,
            "validTo": null,
            "cardNo": "CARD-100013",
            "cardName": "Main card",
            "sourceSummary": ["accessUser", "accessCard"],
            "rawUserPayload": "{\"UserID\":\"100013\"}",
            "rawCardPayload": "{\"CardNo\":\"CARD-100013\"}"
          }
        ]
      }
    ]
  }
}
```

## Create User

Endpoint:

- `POST /identity/users/create`

Purpose:

- create a person on one or many terminals;
- optionally create card and face data in the same request.

Request:

```json
{
  "target": {
    "mode": "devices",
    "deviceIds": ["terminal-1", "terminal-2"]
  },
  "person": {
    "userId": "100013",
    "displayName": "Ivan Petrov",
    "userType": 0,
    "userStatus": 0,
    "authority": 2,
    "citizenIdNo": "900101000001",
    "password": null,
    "useTime": null,
    "isFirstEnter": null,
    "firstEnterDoors": null,
    "doors": [1, 2],
    "timeSections": [1, 1],
    "specialDaysSchedule": null,
    "validFrom": "2026-03-01 00:00:00",
    "validTo": "2026-12-31 23:59:59",
    "card": {
      "cardNo": "CARD-100013",
      "cardName": "Main card",
      "cardType": 0,
      "cardStatus": 0
    },
    "face": {
      "photosBase64": ["<base64-image>"],
      "photoUrls": null
    }
  }
}
```

Face input rules:

- `photosBase64` and `photoUrls` are both supported.
- if `photosBase64` is present and non-empty, adapter sends `PhotoData` to Dahua;
- otherwise adapter uses `photoUrls` and sends `PhotoURL`.

### Create Response

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "deviceId": "terminal-1",
        "operation": "create",
        "status": "success",
        "steps": {
          "accessUser": "success",
          "accessCard": "success",
          "accessFace": "success"
        }
      },
      {
        "deviceId": "terminal-2",
        "operation": "create",
        "status": "failed",
        "steps": {
          "accessUser": "success",
          "accessCard": "failed",
          "accessFace": "skipped"
        },
        "errorCode": "identity_write_failed",
        "errorMessage": "cgi status 500: ..."
      }
    ]
  }
}
```

## Update User

Endpoint:

- `POST /identity/users/update`

Purpose:

- update an existing person on one or many terminals.

The payload is the same as for create.

The response shape is also the same, except:

- `"operation": "update"`
- if `person.face` is provided and the terminal has no existing face record for that `userId`, adapter creates the face record instead of failing the update.

## Bulk Create Users

Endpoint:

- `POST /identity/users/bulk-create`

Purpose:

- create a batch of persons on one or many terminals;
- skip the whole person on a terminal when the same `userId` already exists there.

Request:

```json
{
  "target": {
    "mode": "devices",
    "deviceIds": ["terminal-1", "terminal-2"]
  },
  "persons": [
    {
      "userId": "100013",
      "displayName": "Ivan Petrov"
    },
    {
      "userId": "100014",
      "displayName": "Anna Sidorova"
    }
  ]
}
```

Response:

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "userId": "100013",
        "deviceId": "terminal-1",
        "operation": "create",
        "status": "success",
        "steps": {
          "accessUser": "success",
          "accessCard": "skipped",
          "accessFace": "skipped"
        }
      },
      {
        "userId": "100014",
        "deviceId": "terminal-1",
        "operation": "create",
        "status": "skipped",
        "steps": {
          "accessUser": "skipped",
          "accessCard": "skipped",
          "accessFace": "skipped"
        },
        "skipCode": "user_already_exists",
        "skipMessage": "user already exists on device"
      }
    ]
  }
}
```

Rules:

- `persons[]` must contain at least one valid person payload;
- adapter processes each `person x device` pair independently;
- if a `userId` already exists on a target terminal, adapter returns `status = "skipped"` and does not write user/card/face for that pair;
- other persons and devices continue processing.

## Get User Photo

Endpoint:

- `POST /identity/users/photo/get`

Purpose:

- read the current face/photo payload for one specific `userId` from one specific terminal;
- use Dahua `AccessFace V2` read API.

Request:

```json
{
  "target": {
    "mode": "device",
    "deviceId": "terminal-1"
  },
  "userId": "100013"
}
```

Rules:

- only `target.mode = "device"` is supported;
- adapter reads from Dahua `AccessFace.cgi?action=list`;
- no fallback to V1 face APIs is used;
- if device is not assigned, adapter returns `404`;
- if no face record is returned for the user, adapter returns `404`.

Response:

```json
{
  "success": true,
  "data": {
    "photo": {
      "deviceId": "terminal-1",
      "userId": "100013",
      "photoData": ["<base64-image>"],
      "photoUrl": ["https://example.test/face/100013.jpg"],
      "faceData": ["<base64-face-template>"]
    }
  }
}
```

Notes:

- `photoData` is the raw base64 image array returned by terminal, if present;
- `photoUrl` is returned if the terminal stores face images by URL instead of inline photo data;
- `faceData` is vendor face-template data and should be treated as vendor-specific payload.

## Write Semantics

For each target device, adapter executes steps in order:

1. `AccessUser`
2. `AccessCard` if `person.card` is provided
3. `AccessFace` if `person.face` is provided

Rules:

- if `AccessUser` fails, card and face are skipped;
- if `AccessUser` succeeds and `AccessCard` fails, the device result becomes failed;
- if `AccessFace` fails after successful user/card writes, the device result becomes failed;
- for `update`, `AccessFace` works as upsert: adapter updates existing face data or creates it when missing;
- there is no rollback in the adapter;
- DS/Core should treat the response as the source of truth for per-device reconciliation.

Bulk create adds one pre-check before `AccessUser`:

1. `AccessUser` exact lookup by `userId`
2. if user exists, return `skipped`
3. otherwise continue with normal create pipeline

## Error Semantics

Typical statuses:

- `400`: invalid request body
- `401`: missing/invalid bearer token
- `404`: single-device target not assigned to adapter
- `422`: logical validation error in identity payload
- `500`: unexpected adapter error

Typical error codes:

- `identity_find_error`
- `identity_export_error`
- `identity_photo_get_error`
- `identity_create_error`
- `identity_update_error`
- `identity_bulk_create_error`

## Recommended DS/Core Integration Pattern

For export:

1. Use `view=flat` for import/mapping pipelines.
2. Use `view=grouped` for operator tools and diagnostics.
3. Persist `deviceId + terminalPersonId` as the external identity key per terminal.

For write:

1. Send the same normalized person DTO to all required terminals in one request.
2. Read `results[]` and persist per-device status.
3. Retry only failed devices instead of replaying the whole batch blindly.
4. If card/face fail after user creation, reconcile by issuing a targeted update later.

For bulk create:

1. Send `persons[]` with a shared `target`.
2. Persist results by `userId + deviceId`.
3. Treat `status = "skipped"` with `skipCode = "user_already_exists"` as a no-op success for idempotent import flows.

For photo reads:

1. Persist `deviceId + terminalPersonId` in DS/Core and use it as the lookup key.
2. Call `POST /identity/users/photo/get` only for a concrete terminal and person.
3. Prefer `photoData` for UI or transfer flows; use `photoUrl` only if `photoData` is absent.
