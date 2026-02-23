import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildServer } from "../../src/http/server.js";
describe("POST /ingest/event digest", () => {
    it("ingests AccessControl event after digest challenge", async () => {
        const runtime = makeRuntimeStub();
        const app = buildServer(makeEnv(), runtime);
        try {
            const challenge = await app.inject({
                method: "POST",
                url: "/ingest/event",
                payload: makeAccessPayload(1001)
            });
            expect(challenge.statusCode).toBe(401);
            const authHeader = String(challenge.headers["www-authenticate"] ?? "");
            expect(authHeader.toLowerCase().startsWith("digest ")).toBe(true);
            const digestAuth = makeDigestAuthorization({
                challenge: authHeader,
                method: "POST",
                uri: "/ingest/event",
                username: "push-user",
                password: "push-pass"
            });
            const response = await app.inject({
                method: "POST",
                url: "/ingest/event",
                headers: {
                    authorization: digestAuth
                },
                payload: makeAccessPayload(1001)
            });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({
                success: true,
                data: { accepted: 1 }
            });
            expect(runtime.ingested.length).toBe(1);
            expect(runtime.ingested[0]?.eventId.startsWith("accesscontrol-hash-")).toBe(true);
            expect(runtime.ingested[0]?.deviceId).toBe("dev-1");
        }
        finally {
            await app.close();
        }
    });
    it("accepts request with valid digest without token", async () => {
        const runtime = makeRuntimeStub();
        const app = buildServer(makeEnv(), runtime);
        try {
            const challenge = await app.inject({
                method: "POST",
                url: "/ingest/event",
                payload: makeAccessPayload(1002)
            });
            const authHeader = String(challenge.headers["www-authenticate"] ?? "");
            const digestAuth = makeDigestAuthorization({
                challenge: authHeader,
                method: "POST",
                uri: "/ingest/event",
                username: "push-user",
                password: "push-pass"
            });
            const response = await app.inject({
                method: "POST",
                url: "/ingest/event",
                headers: {
                    authorization: digestAuth
                },
                payload: makeAccessPayload(1002)
            });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({
                success: true,
                data: { accepted: 1 }
            });
            expect(runtime.ingested.length).toBe(1);
            expect(runtime.ingested[0]?.eventId.startsWith("accesscontrol-hash-")).toBe(true);
            expect(runtime.ingested[0]?.deviceId).toBe("dev-1");
        }
        finally {
            await app.close();
        }
    });
    it("rejects request with invalid digest signature", async () => {
        const runtime = makeRuntimeStub();
        const app = buildServer(makeEnv(), runtime);
        try {
            const challenge = await app.inject({
                method: "POST",
                url: "/ingest/event",
                payload: makeAccessPayload(1003)
            });
            const authHeader = String(challenge.headers["www-authenticate"] ?? "");
            const digestAuth = makeDigestAuthorization({
                challenge: authHeader,
                method: "POST",
                uri: "/ingest/event",
                username: "push-user",
                password: "bad-password"
            });
            const response = await app.inject({
                method: "POST",
                url: "/ingest/event",
                headers: {
                    authorization: digestAuth
                },
                payload: makeAccessPayload(1003)
            });
            expect(response.statusCode).toBe(401);
            const body = response.json();
            expect(body.error.code).toBe("unauthorized");
            expect(runtime.ingested.length).toBe(0);
            expect(runtime.failures).toBe(1);
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
function makeRuntimeStub() {
    const ingested = [];
    let failures = 0;
    return {
        ingested,
        get failures() {
            return failures;
        },
        resolvePushAuth(username) {
            if (username !== "push-user") {
                return null;
            }
            return {
                deviceId: "dev-1",
                username: "push-user",
                password: "push-pass"
            };
        },
        getDeviceSettings() {
            return {
                eventCodes: ["AccessControl"],
                timePolicy: { mode: "boundedDevice", maxDriftMs: 60000 }
            };
        },
        getAssignmentDirection() {
            return "IN";
        },
        ingestEvent(event) {
            ingested.push(event);
        },
        markIgnoredEvent() {
            return;
        },
        markIngestFailure() {
            failures += 1;
        },
        getPrometheusMetrics() {
            return "";
        },
        getSnapshot() {
            return { devices: [] };
        },
        async backfill() {
            return [];
        },
        async findIdentity() {
            return [];
        }
    };
}
function makeAccessPayload(recNo) {
    return {
        Code: "AccessControl",
        Action: "Pulse",
        Index: 0,
        Data: {
            RecNo: recNo,
            UTC: Math.floor(Date.now() / 1000),
            UserID: `person-${recNo}`,
            CardNo: `card-${recNo}`,
            Type: "Entry",
            Method: 1,
            Status: 1
        }
    };
}
function makeDigestAuthorization(input) {
    const realm = readChallengeField(input.challenge, "realm");
    const nonce = readChallengeField(input.challenge, "nonce");
    const qop = readChallengeField(input.challenge, "qop") ?? "auth";
    const nc = "00000001";
    const cnonce = "abcdef123456";
    const ha1 = md5(`${input.username}:${realm}:${input.password}`);
    const ha2 = md5(`${input.method.toUpperCase()}:${input.uri}`);
    const response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    return [
        `Digest username="${input.username}"`,
        `realm="${realm}"`,
        `nonce="${nonce}"`,
        `uri="${input.uri}"`,
        `response="${response}"`,
        `qop=${qop}`,
        `nc=${nc}`,
        `cnonce="${cnonce}"`
    ].join(", ");
}
function readChallengeField(challenge, key) {
    const match = challenge.match(new RegExp(`${key}="([^"]+)"`));
    return match?.[1] ?? "";
}
function md5(value) {
    return createHash("md5").update(value).digest("hex");
}
