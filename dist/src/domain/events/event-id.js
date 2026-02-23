import { createHash } from "node:crypto";
export function buildStableEventId(seed) {
    const identity = [
        seed.deviceId,
        seed.eventCode,
        String(seed.occurredAt),
        seed.uid ?? "",
        String(seed.index),
        seed.terminalPersonId ?? "",
        seed.rawText
    ].join("|");
    const digest = createHash("sha256").update(identity).digest("hex");
    return `${seed.eventCode.toLowerCase()}-${digest}`;
}
