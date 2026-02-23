import { describe, expect, it } from "vitest";
import { buildServer } from "../../src/http/server.js";
describe("POST /events/backfill", () => {
    it("returns 401 when bearer token is missing", async () => {
        const env = makeEnv();
        const runtime = makeRuntimeStub([]);
        const app = buildServer(env, runtime);
        try {
            const response = await app.inject({
                method: "POST",
                url: "/events/backfill",
                payload: { deviceId: "dev-1", sinceEventId: null, limit: 10 }
            });
            expect(response.statusCode).toBe(401);
            expect(response.json()).toEqual({
                success: false,
                error: {
                    code: "unauthorized",
                    message: "unauthorized"
                }
            });
            expect(runtime.calls.length).toBe(0);
        }
        finally {
            await app.close();
        }
    });
    it("returns backfill events for authorized request", async () => {
        const env = makeEnv();
        const events = [makeEvent("evt-1")];
        const runtime = makeRuntimeStub(events);
        const app = buildServer(env, runtime);
        try {
            const payload = { deviceId: "dev-1", sinceEventId: "evt-0", limit: 5 };
            const response = await app.inject({
                method: "POST",
                url: "/events/backfill",
                headers: {
                    authorization: `Bearer ${env.BACKFILL_BEARER_TOKEN}`
                },
                payload
            });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({
                success: true,
                data: { events }
            });
            expect(runtime.calls).toEqual([payload]);
        }
        finally {
            await app.close();
        }
    });
    it("returns 400 for invalid payload and does not call runtime", async () => {
        const env = makeEnv();
        const runtime = makeRuntimeStub([]);
        const app = buildServer(env, runtime);
        try {
            const response = await app.inject({
                method: "POST",
                url: "/events/backfill",
                headers: {
                    authorization: `Bearer ${env.BACKFILL_BEARER_TOKEN}`
                },
                payload: { deviceId: "dev-1", sinceEventId: null, limit: 0 }
            });
            expect(response.statusCode).toBe(400);
            const body = response.json();
            expect(body.error.message).toBe("invalid backfill request");
            expect(runtime.calls.length).toBe(0);
        }
        finally {
            await app.close();
        }
    });
});
function makeEnv() {
    return {
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: 8091,
        BASE_URL: "http://127.0.0.1:8091",
        VENDOR_KEY: "dahua",
        ADAPTER_INSTANCE_KEY: "dahua-test",
        ADAPTER_INSTANCE_NAME: "Dahua Test",
        ADAPTER_VERSION: "1.0.0",
        RETENTION_MS: 60000,
        DS_BASE_URL: "http://127.0.0.1:3000",
        DS_BEARER_TOKEN: "ds-token",
        DS_HMAC_SECRET: "ds-secret",
        BACKFILL_BEARER_TOKEN: "backfill-token",
        PUSH_DIGEST_REALM: "dahua-adapter",
        PUSH_DIGEST_NONCE_TTL_MS: 300000,
        SQLITE_PATH: "./tmp/test.db",
        HEARTBEAT_INTERVAL_MS: 1000,
        DELIVERY_INTERVAL_MS: 1000,
        PURGE_INTERVAL_MS: 1000,
        DEVICE_RECONNECT_DELAY_MS: 1000,
        HTTP_TIMEOUT_MS: 1000,
        REJECT_UNAUTHORIZED: false,
        MOCK_ENABLED: false,
        MOCK_EVENT_BURST_INTERVAL_MS: 30000,
        MOCK_EVENT_INTRA_INTERVAL_MS: 2000,
        MOCK_EVENT_BURST_MIN: 2,
        MOCK_EVENT_BURST_MAX: 3
    };
}
function makeRuntimeStub(events) {
    const calls = [];
    return {
        calls,
        async backfill(input) {
            calls.push(input);
            return events;
        }
    };
}
function makeEvent(eventId) {
    return {
        eventId,
        deviceId: "dev-1",
        direction: "IN",
        occurredAt: 1700000000000,
        terminalPersonId: null,
        rawPayload: "{}"
    };
}
