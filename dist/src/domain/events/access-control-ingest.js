import { toRawDahuaEvent } from "../../infra/dahua/parsers/access-control-push.js";
import { resolveOccurredAtFromAccessEvent } from "./occurred-at.js";
import { buildAccessEventId } from "../backfill/backfill-service.js";
export function normalizeAccessControlEvent(input) {
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
function parseOptionalInt(value) {
    if (!value) {
        return null;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}
