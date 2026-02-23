import { afterEach, describe, expect, it } from "vitest";
import { loadEnv } from "../../src/config/env.js";
const originalEnv = process.env;
afterEach(() => {
    process.env = originalEnv;
});
describe("loadEnv", () => {
    it("rejects mock mode outside development", () => {
        process.env = makeBaseEnv({
            NODE_ENV: "test",
            MOCK_ENABLED: "true"
        });
        expect(() => loadEnv()).toThrow("MOCK_ENABLED is allowed only when NODE_ENV=development");
    });
});
function makeBaseEnv(overrides) {
    return {
        NODE_ENV: "development",
        HOST: "127.0.0.1",
        PORT: "8091",
        BASE_URL: "http://127.0.0.1:8091",
        VENDOR_KEY: "dahua",
        ADAPTER_INSTANCE_KEY: "dahua-test",
        ADAPTER_INSTANCE_NAME: "Dahua Test",
        ADAPTER_VERSION: "1.0.0",
        RETENTION_MS: "60000",
        DS_BASE_URL: "http://127.0.0.1:3000",
        DS_BEARER_TOKEN: "ds-token",
        DS_HMAC_SECRET: "ds-secret",
        BACKFILL_BEARER_TOKEN: "backfill-token",
        SQLITE_PATH: "./tmp/test.db",
        HEARTBEAT_INTERVAL_MS: "1000",
        DELIVERY_INTERVAL_MS: "1000",
        PURGE_INTERVAL_MS: "1000",
        DEVICE_RECONNECT_DELAY_MS: "1000",
        HTTP_TIMEOUT_MS: "1000",
        REJECT_UNAUTHORIZED: "false",
        MOCK_ENABLED: "false",
        MOCK_EVENT_BURST_INTERVAL_MS: "30000",
        MOCK_EVENT_INTRA_INTERVAL_MS: "2000",
        MOCK_EVENT_BURST_MIN: "2",
        MOCK_EVENT_BURST_MAX: "3",
        ...overrides
    };
}
