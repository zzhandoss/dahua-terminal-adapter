import type { NormalizedEvent } from "../../contracts/device-service.js";
import type { DeviceDirection } from "../../contracts/device-service.js";
import type { DahuaTimePolicy } from "../devices/device-settings.js";
import type { EventUploadBody } from "../../infra/dahua/parsers/access-control-push.js";
import { toRawDahuaEvent } from "../../infra/dahua/parsers/access-control-push.js";
import { resolveOccurredAtFromAccessEvent } from "./occurred-at.js";
import { buildAccessEventId } from "../backfill/backfill-service.js";

export function normalizeAccessControlEvent(
  input: {
    deviceId: string;
    direction: DeviceDirection;
    event: EventUploadBody;
    timePolicy: DahuaTimePolicy;
  }
): NormalizedEvent | null {
  const raw = toRawDahuaEvent(input.event);
  if (raw.code !== "AccessControl") {
    return null;
  }

  const occurredAt = resolveOccurredAtFromAccessEvent(raw, input.timePolicy);
  const userId = readString(raw.data, "UserID");
  const cardNo = readString(raw.data, "CardNo");
  const type = readString(raw.data, "Type");
  const method = parseOptionalInt(readString(raw.data, "Method"));
  const eventId = buildAccessEventId({
    occurredAt,
    index: raw.index,
    data: raw.data
  });

  return {
    eventId,
    deviceId: input.deviceId,
    direction: input.direction,
    occurredAt,
    terminalPersonId: userId ?? cardNo ?? null,
    rawPayload: raw.rawText
  };
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}

function parseOptionalInt(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}
