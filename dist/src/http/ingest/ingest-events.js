import { normalizeAccessControlEvent } from "../../domain/events/access-control-ingest.js";
export function ingestEvents(runtime, deviceId, events, log) {
    let accepted = 0;
    const settings = runtime.getDeviceSettings(deviceId);
    const direction = runtime.getAssignmentDirection(deviceId);
    if (!settings || !direction) {
        runtime.markIngestFailure();
        return accepted;
    }
    for (const item of events) {
        const normalized = normalizeAccessControlEvent({
            deviceId,
            direction,
            event: item,
            timePolicy: settings.timePolicy
        });
        if (!normalized || !settings.eventCodes.includes("AccessControl")) {
            runtime.markIgnoredEvent();
            continue;
        }
        runtime.ingestEvent(normalized);
        log.info({
            deviceId,
            eventId: normalized.eventId,
            code: "AccessControl",
            occurredAt: normalized.occurredAt
        }, "accesscontrol event queued for DS delivery");
        accepted += 1;
    }
    return accepted;
}
