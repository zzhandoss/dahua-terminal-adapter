import { buildAccessEventId } from "../../backfill/backfill-service.js";
export class AccessControlStrategy {
    supports(event) {
        return event.code === "AccessControl";
    }
    normalize(event, context) {
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
function readString(source, key) {
    const value = source[key];
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number") {
        return String(value);
    }
    return null;
}
