import { describe, expect, it } from "vitest";
import { resolveOccurredAtWithPolicy } from "../../../src/domain/events/occurred-at.js";
describe("resolveOccurredAtWithPolicy", () => {
    it("uses device timestamp when drift is within configured bound", () => {
        const now = Date.parse("2026-02-12T10:00:00Z");
        const event = makeEvent("2026-02-12T10:00:20Z");
        const result = resolveOccurredAtWithPolicy(event, { mode: "boundedDevice", maxDriftMs: 60_000 }, now);
        expect(result.usedFallback).toBe(false);
        expect(result.occurredAt).toBe(Date.parse("2026-02-12T10:00:20Z"));
        expect(result.driftMs).toBe(20_000);
    });
    it("falls back to adapter time when drift exceeds bound", () => {
        const now = Date.parse("2026-02-12T10:00:00Z");
        const event = makeEvent("2026-02-12T10:10:00Z");
        const result = resolveOccurredAtWithPolicy(event, { mode: "boundedDevice", maxDriftMs: 60_000 }, now);
        expect(result.usedFallback).toBe(true);
        expect(result.occurredAt).toBe(now);
        expect(result.driftMs).toBe(600_000);
    });
    it("always uses adapter time in adapter mode", () => {
        const now = Date.parse("2026-02-12T10:00:00Z");
        const event = makeEvent("2026-02-12 10:00:20");
        const result = resolveOccurredAtWithPolicy(event, { mode: "adapter", maxDriftMs: 1 }, now);
        expect(result.usedFallback).toBe(true);
        expect(result.occurredAt).toBe(now);
        expect(result.driftMs).toBeNull();
    });
});
function makeEvent(timestamp) {
    return {
        code: "AccessControl",
        action: "Pulse",
        index: 0,
        rawText: "raw",
        raw: {
            "Events[0].UTC": timestamp
        },
        data: {}
    };
}
