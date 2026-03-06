import { describe, expect, it } from "vitest";
import type { AppEnv } from "../../src/config/env.js";
import type { AdapterRuntime } from "../../src/app/adapter-runtime.js";
import { buildServer } from "../../src/http/server.js";

describe("POST /identity/users/bulk-create", () => {
  it("returns 400 for invalid payload", async () => {
    const runtime = makeRuntimeStub();
    const app = buildServer(makeEnv(), runtime as unknown as AdapterRuntime);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/identity/users/bulk-create",
        headers: {
          authorization: "Bearer backfill-token"
        },
        payload: {
          target: { mode: "device", deviceId: "dev-1" },
          persons: []
        }
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("returns per person and per device results", async () => {
    const runtime = makeRuntimeStub([
      {
        userId: "u-1",
        deviceId: "dev-1",
        operation: "create",
        status: "success",
        steps: {
          accessUser: "success",
          accessCard: "skipped",
          accessFace: "skipped"
        }
      },
      {
        userId: "u-2",
        deviceId: "dev-1",
        operation: "create",
        status: "skipped",
        steps: {
          accessUser: "skipped",
          accessCard: "skipped",
          accessFace: "skipped"
        },
        skipCode: "user_already_exists",
        skipMessage: "user already exists on device"
      }
    ]);
    const app = buildServer(makeEnv(), runtime as unknown as AdapterRuntime);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/identity/users/bulk-create",
        headers: {
          authorization: "Bearer backfill-token"
        },
        payload: {
          target: { mode: "device", deviceId: "dev-1" },
          persons: [
            { userId: "u-1", displayName: "User 1" },
            { userId: "u-2", displayName: "User 2" }
          ]
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        data: {
          results: [
            {
              userId: "u-1",
              deviceId: "dev-1",
              operation: "create",
              status: "success",
              steps: {
                accessUser: "success",
                accessCard: "skipped",
                accessFace: "skipped"
              }
            },
            {
              userId: "u-2",
              deviceId: "dev-1",
              operation: "create",
              status: "skipped",
              steps: {
                accessUser: "skipped",
                accessCard: "skipped",
                accessFace: "skipped"
              },
              skipCode: "user_already_exists",
              skipMessage: "user already exists on device"
            }
          ]
        }
      });
    } finally {
      await app.close();
    }
  });
});

function makeRuntimeStub(bulkCreateResults: Array<Record<string, unknown>> = []) {
  return {
    async backfill() {
      return [];
    },
    async findIdentity() {
      return [];
    },
    async exportIdentityUsers() {
      return {
        view: "flat" as const,
        users: [],
        devices: []
      };
    },
    async createIdentityUser() {
      return [];
    },
    async updateIdentityUser() {
      return [];
    },
    async getIdentityUserPhoto() {
      return {
        deviceId: "dev-1",
        userId: "u-1",
        photoData: null,
        photoUrl: null,
        faceData: null
      };
    },
    async bulkCreateIdentityUsers() {
      return bulkCreateResults;
    }
  };
}

function makeEnv(): AppEnv {
  return {
    NODE_ENV: "test",
    LOG_OUTPUT: "auto",
    LOG_DIR: "./data/logs",
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
