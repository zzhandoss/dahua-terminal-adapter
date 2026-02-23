import { afterEach, describe, expect, it, vi } from "vitest";
import { AdapterRuntime } from "../../src/app/adapter-runtime.js";
import { DEVICE_SETTINGS_SCHEMA_VERSION } from "../../src/domain/devices/device-settings-schema.js";
import { PermanentDeviceServiceError } from "../../src/infra/ds/device-service-client.js";
afterEach(() => {
    vi.useRealTimers();
});
describe("AdapterRuntime start", () => {
    it("sends deviceSettingsSchema in register payload", async () => {
        const register = vi.fn().mockResolvedValue(makeLease());
        const dsClient = makeDsClient(register);
        const runtime = new AdapterRuntime(makeEnv(), dsClient, makeStoreStub(), {}, makeLoggerStub());
        try {
            await runtime.start();
            expect(register).toHaveBeenCalledTimes(1);
            const payload = register.mock.calls[0]?.[0];
            expect(payload.deviceSettingsSchemaVersion).toBe(DEVICE_SETTINGS_SCHEMA_VERSION);
            expect(payload.deviceSettingsSchema).toBeDefined();
        }
        finally {
            await runtime.stop();
        }
    });
    it("retries register until DS becomes available", async () => {
        vi.useFakeTimers();
        const register = vi
            .fn()
            .mockRejectedValueOnce(new Error("ds down #1"))
            .mockRejectedValueOnce(new Error("ds down #2"))
            .mockResolvedValue(makeLease());
        const logger = makeLoggerStub();
        const runtime = new AdapterRuntime(makeEnv(), makeDsClient(register), makeStoreStub(), {}, logger);
        try {
            const startPromise = runtime.start();
            await vi.advanceTimersByTimeAsync(3000);
            await startPromise;
            expect(register).toHaveBeenCalledTimes(3);
            expect(logger.warn).toHaveBeenCalled();
        }
        finally {
            await runtime.stop();
        }
    });
    it("re-registers when heartbeat returns adapter_inactive", async () => {
        vi.useFakeTimers();
        const register = vi
            .fn()
            .mockResolvedValueOnce(makeLease("adapter-old"))
            .mockResolvedValueOnce(makeLease("adapter-new"));
        const heartbeat = vi
            .fn()
            .mockRejectedValueOnce(new PermanentDeviceServiceError("inactive", {
            statusCode: 409,
            code: "adapter_inactive",
            path: "/adapters/heartbeat"
        }))
            .mockResolvedValue(makeLease("adapter-new"));
        const runtime = new AdapterRuntime(makeEnv({ HEARTBEAT_INTERVAL_MS: 10 }), {
            register,
            heartbeat,
            ingestEvents: vi.fn().mockResolvedValue({ results: [] })
        }, makeStoreStub(), {}, makeLoggerStub());
        try {
            await runtime.start();
            await vi.advanceTimersByTimeAsync(200);
            await vi.runOnlyPendingTimersAsync();
            await Promise.resolve();
            expect(register).toHaveBeenCalledTimes(2);
            expect(heartbeat).toHaveBeenCalled();
        }
        finally {
            await runtime.stop();
        }
    });
});
function makeDsClient(register) {
    return {
        register,
        heartbeat: vi.fn().mockResolvedValue(makeLease()),
        ingestEvents: vi.fn().mockResolvedValue({ results: [] })
    };
}
function makeStoreStub() {
    return {
        setLastAckedEventId: vi.fn(),
        getLastAckedEventId: vi.fn().mockReturnValue(null),
        listPending: vi.fn().mockReturnValue([]),
        markAcked: vi.fn(),
        purgeExpired: vi.fn().mockReturnValue(0)
    };
}
function makeLoggerStub() {
    return {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    };
}
function makeLease(adapterId = "adapter-1") {
    return {
        adapterId,
        instanceKey: "dahua-primary",
        instanceName: "Dahua Adapter",
        mode: "active",
        heartbeatIntervalMs: 3_600_000,
        batchLimit: 100,
        devices: []
    };
}
function makeEnv(overrides = {}) {
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
        MOCK_EVENT_BURST_MAX: 3,
        ...overrides
    };
}
