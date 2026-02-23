import { describe, expect, it } from "vitest";
import { buildServer } from "../../src/http/server.js";
describe("POST /identity/find", () => {
    it("returns 401 when token is missing", async () => {
        const runtime = makeRuntimeStub();
        const app = buildServer(makeEnv(), runtime);
        try {
            const response = await app.inject({
                method: "POST",
                url: "/identity/find",
                payload: {
                    deviceId: "dev-1",
                    identityKey: "documentNumber",
                    identityValue: "123",
                    limit: 1
                }
            });
            expect(response.statusCode).toBe(401);
            expect(runtime.calls.length).toBe(0);
        }
        finally {
            await app.close();
        }
    });
    it("returns 400 for invalid request", async () => {
        const runtime = makeRuntimeStub();
        const app = buildServer(makeEnv(), runtime);
        try {
            const response = await app.inject({
                method: "POST",
                url: "/identity/find",
                headers: {
                    authorization: "Bearer backfill-token"
                },
                payload: {
                    deviceId: "dev-1",
                    identityKey: "documentNumber",
                    identityValue: "",
                    limit: 0
                }
            });
            expect(response.statusCode).toBe(400);
            expect(runtime.calls.length).toBe(0);
        }
        finally {
            await app.close();
        }
    });
    it("returns matches for valid request", async () => {
        const runtime = makeRuntimeStub([
            {
                terminalPersonId: "tp-1",
                score: 99,
                rawPayload: "{}"
            }
        ]);
        const app = buildServer(makeEnv(), runtime);
        try {
            const payload = {
                deviceId: "dev-1",
                identityKey: "documentNumber",
                identityValue: "123456",
                limit: 1
            };
            const response = await app.inject({
                method: "POST",
                url: "/identity/find",
                headers: {
                    authorization: "Bearer backfill-token"
                },
                payload
            });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({
                success: true,
                data: {
                    matches: [{ terminalPersonId: "tp-1", score: 99, rawPayload: "{}" }]
                }
            });
            expect(runtime.calls).toEqual([payload]);
        }
        finally {
            await app.close();
        }
    });
});
describe("POST /identity/export-users", () => {
    it("returns 401 when token is missing", async () => {
        const runtime = makeRuntimeStub();
        const app = buildServer(makeEnv(), runtime);
        try {
            const response = await app.inject({
                method: "POST",
                url: "/identity/export-users",
                payload: { deviceId: "dev-1" }
            });
            expect(response.statusCode).toBe(401);
        }
        finally {
            await app.close();
        }
    });
    it("returns users for valid request", async () => {
        const runtime = makeRuntimeStub([], [
            {
                terminalPersonId: "u-1",
                displayName: "User 1",
                userType: "0",
                cardNo: "C-1",
                source: "accessUser",
                rawPayload: "{}"
            }
        ]);
        const app = buildServer(makeEnv(), runtime);
        try {
            const response = await app.inject({
                method: "POST",
                url: "/identity/export-users",
                headers: {
                    authorization: "Bearer backfill-token"
                },
                payload: {
                    deviceId: "dev-1",
                    limit: 10,
                    offset: 0,
                    includeCards: false
                }
            });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({
                success: true,
                data: {
                    users: [
                        {
                            terminalPersonId: "u-1",
                            displayName: "User 1",
                            userType: "0",
                            cardNo: "C-1",
                            source: "accessUser",
                            rawPayload: "{}"
                        }
                    ]
                }
            });
        }
        finally {
            await app.close();
        }
    });
});
function makeRuntimeStub(matches = [], users = []) {
    const calls = [];
    const exportCalls = [];
    return {
        calls,
        exportCalls,
        async backfill() {
            return [];
        },
        async findIdentity(input) {
            calls.push(input);
            return matches;
        },
        async exportIdentityUsers(input) {
            exportCalls.push(input);
            return users;
        }
    };
}
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
