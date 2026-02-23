import type { NormalizedEvent } from "../../../contracts/device-service.js";
import type { RawDahuaEvent } from "../../../infra/dahua/dahua-client.js";
import type { EventNormalizationStrategy, NormalizeContext } from "./strategy.js";
import { buildAccessEventId } from "../../backfill/backfill-service.js";

export class AccessControlStrategy implements EventNormalizationStrategy {
  supports(event: RawDahuaEvent): boolean {
    return event.code === "AccessControl";
  }

  normalize(event: RawDahuaEvent, context: NormalizeContext): NormalizedEvent | null {
    const data = event.data;
    const userId = readString(data, "UserID");
    const cardNo = readString(data, "CardNo");
    const eventId = buildAccessEventId({
      occurredAt: context.occurredAt,
      index: event.index,
      data
    });

    return {
      eventId,
      deviceId: context.deviceId,
      direction: context.direction,
      occurredAt: context.occurredAt,
      terminalPersonId: userId ?? cardNo ?? null,
      rawPayload: event.rawText
    };
  }
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
