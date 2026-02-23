import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { DahuaClientFactory } from "../../src/app/dahua-client-factory.js";
import { DeviceWorker } from "../../src/app/device-worker.js";
import { EventNormalizationPipeline } from "../../src/domain/events/event-normalization-pipeline.js";
import { EventStrategyRegistry } from "../../src/domain/events/event-strategy-registry.js";
import { FaceRecognitionStrategy } from "../../src/domain/events/strategies/face-recognition-strategy.js";
import { SqliteStore } from "../../src/infra/store/sqlite-store.js";
import { makeFaceRecognitionPayload } from "../mocks/dahua/event-payload-factory.js";
import { createMockDahuaDevice } from "../mocks/dahua/mock-dahua-device.js";
const require = createRequire(import.meta.url);
const sqliteAvailable = (() => {
    try {
        const Database = require("better-sqlite3");
        const db = new Database(":memory:");
        db.close();
        return true;
    }
    catch {
        return false;
    }
})();
const suite = sqliteAvailable ? describe : describe.skip;
suite("DeviceWorker with mock dahua device", () => {
    it("ingests FaceRecognition stream and ignores malformed payload", async () => {
        const dir = mkdtempSync(join(tmpdir(), "dahua-adapter-worker-test-"));
        const dbPath = join(dir, "worker.db");
        const store = new SqliteStore(dbPath);
        const mock = createMockDahuaDevice({
            username: "admin",
            password: "secret",
            scenario: [
                {
                    payload: makeFaceRecognitionPayload({
                        index: 1,
                        terminalPersonId: "person-1",
                        documentId: "990000000001",
                        occurredAt: "2026-02-11 11:00:00"
                    }),
                    delayMs: 5
                },
                {
                    payload: makeFaceRecognitionPayload({ malformed: true, index: 2 }),
                    delayMs: 5
                },
                {
                    payload: makeFaceRecognitionPayload({
                        index: 1,
                        terminalPersonId: "person-1",
                        documentId: "990000000001",
                        occurredAt: "2026-02-11 11:00:00"
                    }),
                    delayMs: 5
                }
            ]
        });
        const pipeline = new EventNormalizationPipeline(new EventStrategyRegistry([new FaceRecognitionStrategy()]));
        try {
            const started = await mock.start();
            const target = new URL(started.baseUrl);
            const assignment = {
                deviceId: "dev-mock-1",
                direction: "IN",
                settingsJson: JSON.stringify({
                    protocol: "http",
                    host: target.hostname,
                    port: Number(target.port),
                    username: "admin",
                    password: "secret",
                    eventCodes: ["FaceRecognition"],
                    heartbeatSec: 1,
                    requestTimeoutMs: 5000,
                    rejectUnauthorized: false,
                    identityQueryMappings: {
                        documentNumber: {
                            provider: "dahua.findPerson",
                            groupIds: ["10000"],
                            paramsTemplate: {
                                "person.id": "{{identityValue}}",
                                "person.certificateType": "IC"
                            }
                        }
                    }
                }),
                lastAckedEventId: null
            };
            const worker = new DeviceWorker({
                assignment,
                retentionMs: 60_000,
                reconnectDelayMs: 50,
                pipeline,
                store,
                clientFactory: new DahuaClientFactory({
                    requestTimeoutMs: 5000,
                    rejectUnauthorized: false,
                    mockEnabled: false,
                    mockBurstIntervalMs: 30000,
                    mockIntraIntervalMs: 2000,
                    mockBurstMin: 2,
                    mockBurstMax: 3
                }),
                logger: pino({ level: "silent" })
            });
            worker.start();
            await waitFor(() => store.listPending(10).length >= 1, 3000, "worker did not persist events from stream");
            const pending = store.listPending(10);
            expect(pending.length).toBe(1);
            expect(pending[0]?.deviceId).toBe("dev-mock-1");
            expect(pending[0]?.terminalPersonId).toBe("person-1");
            await worker.stop();
        }
        finally {
            await mock.stop();
            store.close();
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
async function waitFor(predicate, timeoutMs, message) {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) {
            throw new Error(message);
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
}
