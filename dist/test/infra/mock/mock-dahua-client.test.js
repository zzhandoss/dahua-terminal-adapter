import { describe, expect, it } from "vitest";
import { MockDahuaClient } from "../../../src/infra/mock/mock-dahua-client.js";
import { MockPersonStore } from "../../../src/infra/mock/person-store.js";
describe("MockDahuaClient", () => {
    it("emits face recognition events from mock stream", async () => {
        const client = new MockDahuaClient({
            deviceId: "dev-1",
            burstIntervalMs: 30,
            intraEventIntervalMs: 5,
            burstMin: 2,
            burstMax: 2,
            identitySelector: "person.id",
            personStore: new MockPersonStore(),
            random: () => 0
        });
        const signal = new AbortController();
        const events = [];
        for await (const event of client.attachEventStream(["FaceRecognition"], 30, signal.signal)) {
            events.push(event);
            if (events.length === 2) {
                signal.abort();
            }
        }
        expect(events.length).toBe(2);
        expect(events[0]?.code).toBe("FaceRecognition");
    });
    it("supports exact findPerson for configured person selector", async () => {
        const client = new MockDahuaClient({
            deviceId: "dev-1",
            burstIntervalMs: 30,
            intraEventIntervalMs: 5,
            burstMin: 2,
            burstMax: 2,
            identitySelector: "person.id",
            personStore: new MockPersonStore(),
            random: () => 0
        });
        const found = await client.findPerson({
            person: { id: "900101000001" },
            groupIds: ["10000"]
        });
        expect(found.length).toBe(1);
        expect(found[0]?.candidates[0]?.person.uid).toBe("tp-0001");
    });
});
