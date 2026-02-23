import { parseDahuaSettings } from "../devices/device-settings.js";
import { createHash } from "node:crypto";
export class BackfillService {
    store;
    assignments;
    clientFactory;
    logger;
    constructor(store, assignments, clientFactory, logger) {
        this.store = store;
        this.assignments = assignments;
        this.clientFactory = clientFactory;
        this.logger = logger;
    }
    async fetch(input) {
        const local = this.store.getBackfill(input.deviceId, input.sinceEventId, input.limit);
        if (local.length >= input.limit) {
            return local;
        }
        const assignment = this.assignments.get(input.deviceId);
        if (!assignment) {
            return local;
        }
        const settings = parseDahuaSettings(assignment.settingsJson);
        if (!settings.recordBackfillEnabled) {
            return local;
        }
        const nowSec = Math.floor(Date.now() / 1000);
        const startSec = nowSec - settings.backfillLookbackHours * 3600;
        const context = this.clientFactory.create(assignment);
        try {
            await context.client.connect();
            const rows = await context.client.findAccessControlRecords({
                startTimeUtcSec: startSec,
                endTimeUtcSec: nowSec,
                count: Math.min(settings.backfillQueryLimit, Math.max(input.limit * 4, input.limit))
            });
            const remote = rows
                .sort((a, b) => a.recNo - b.recNo)
                .map((row) => {
                const occurredAt = (row.createTimeUtcSec ?? nowSec) * 1000;
                const rawPayload = JSON.stringify({
                    source: "recordFinder",
                    code: "AccessControl",
                    action: "Pulse",
                    index: 0,
                    data: row.raw
                });
                return {
                    eventId: buildAccessEventId({
                        occurredAt,
                        index: 0,
                        data: row.raw
                    }),
                    deviceId: input.deviceId,
                    direction: assignment.direction,
                    occurredAt,
                    terminalPersonId: row.userId ?? row.cardNo ?? null,
                    rawPayload
                };
            });
            const merged = dedupeByEventId([...local, ...remote]);
            return merged.slice(0, input.limit);
        }
        catch (error) {
            this.logger.error({ err: error, deviceId: input.deviceId }, "recordFinder backfill failed");
            return local;
        }
        finally {
            await context.client.close().catch(() => undefined);
        }
    }
}
function dedupeByEventId(events) {
    const seen = new Set();
    const out = [];
    for (const event of events) {
        const dedupeKey = `${event.deviceId}:${event.eventId}`;
        if (seen.has(dedupeKey)) {
            continue;
        }
        seen.add(dedupeKey);
        out.push(event);
    }
    return out;
}
export function buildAccessFallbackEventId(input) {
    return buildAccessEventId(input);
}
export function buildAccessEventId(input) {
    const eventTsRaw = readDataField(input.data, ["RealUTC", "UTC", "CreateTime"]);
    const eventTs = eventTsRaw.length > 0 ? eventTsRaw : String(Math.floor(input.occurredAt / 1000));
    const userId = readDataField(input.data, ["UserID"]);
    const identity = ["AccessControl", eventTs, userId].join("|");
    const digest = createHash("sha256").update(identity).digest("hex");
    return `accesscontrol-hash-${digest}`;
}
function readDataField(data, keys) {
    for (const key of keys) {
        if (key in data) {
            const value = data[key];
            if (typeof value === "string") {
                return value;
            }
            if (typeof value === "number" || typeof value === "boolean") {
                return String(value);
            }
            if (value === null || value === undefined) {
                return "";
            }
            return JSON.stringify(value);
        }
    }
    return "";
}
