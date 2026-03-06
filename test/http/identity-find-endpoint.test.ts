import { describe, expect, it } from "vitest";
import type { AppEnv } from "../../src/config/env.js";
import type { AdapterRuntime } from "../../src/app/adapter-runtime.js";
import { buildServer } from "../../src/http/server.js";

describe("POST /identity/find", () => {
  it("returns 401 when token is missing", async () => {
    const runtime = makeRuntimeStub();
    const app = buildServer(makeEnv(), runtime as unknown as AdapterRuntime);

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
    } finally {
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
    const app = buildServer(makeEnv(), runtime as unknown as AdapterRuntime);

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
    } finally {
      await app.close();
    }
  });
});

describe("POST /identity/export-users", () => {
  it("returns 401 when token is missing", async () => {
    const runtime = makeRuntimeStub();
    const app = buildServer(makeEnv(), runtime as unknown as AdapterRuntime);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/identity/export-users",
        payload: {
          target: {
            mode: "device",
            deviceId: "dev-1"
          }
        }
      });
      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("returns flat export payload for valid request", async () => {
    const runtime = makeRuntimeStub([], {
      view: "flat",
      users: [
        {
          deviceId: "dev-1",
          terminalPersonId: "u-1",
          displayName: "User 1",
          userType: "0",
          userStatus: "0",
          authority: "1",
          citizenIdNo: "900101000001",
          validFrom: null,
          validTo: null,
          cardNo: "C-1",
          cardName: "Card 1",
          sourceSummary: ["accessUser", "accessCard"],
          rawUserPayload: "{}",
          rawCardPayload: "{}"
        }
      ],
      devices: [
        {
          deviceId: "dev-1",
          exportedCount: 1,
          failed: false,
          hasMore: false
        }
      ]
    });
    const app = buildServer(makeEnv(), runtime as unknown as AdapterRuntime);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/identity/export-users",
        headers: {
          authorization: "Bearer backfill-token"
        },
        payload: {
          target: {
            mode: "device",
            deviceId: "dev-1"
          },
          view: "flat",
          limit: 10,
          offset: 0,
          includeCards: true
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        data: {
          view: "flat",
          users: [
            {
              deviceId: "dev-1",
              terminalPersonId: "u-1",
              displayName: "User 1",
              userType: "0",
              userStatus: "0",
              authority: "1",
              citizenIdNo: "900101000001",
              validFrom: null,
              validTo: null,
              cardNo: "C-1",
              cardName: "Card 1",
              sourceSummary: ["accessUser", "accessCard"],
              rawUserPayload: "{}",
              rawCardPayload: "{}"
            }
          ],
          devices: [
            {
              deviceId: "dev-1",
              exportedCount: 1,
              failed: false,
              hasMore: false
            }
          ]
        }
      });
    } finally {
      await app.close();
    }
  });
});

describe("POST /identity/users/create", () => {
  it("returns validation errors for invalid payload", async () => {
    const runtime = makeRuntimeStub();
    const app = buildServer(makeEnv(), runtime as unknown as AdapterRuntime);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/identity/users/create",
        headers: {
          authorization: "Bearer backfill-token"
        },
        payload: {
          target: { mode: "device", deviceId: "dev-1" },
          person: { userId: "", displayName: "" }
        }
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("returns per-device results", async () => {
    const runtime = makeRuntimeStub([], undefined, [
      {
        deviceId: "dev-1",
        operation: "create",
        status: "success",
        steps: {
          accessUser: "success",
          accessCard: "success",
          accessFace: "success"
        }
      }
    ]);
    const app = buildServer(makeEnv(), runtime as unknown as AdapterRuntime);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/identity/users/create",
        headers: {
          authorization: "Bearer backfill-token"
        },
        payload: {
          target: { mode: "device", deviceId: "dev-1" },
          person: {
            userId: "u-1",
            displayName: "User 1",
            card: {
              cardNo: "C-1"
            },
            face: {
              photosBase64: ["base64-image"]
            }
          }
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        data: {
          results: [
            {
              deviceId: "dev-1",
              operation: "create",
              status: "success",
              steps: {
                accessUser: "success",
                accessCard: "success",
                accessFace: "success"
              }
            }
          ]
        }
      });
    } finally {
      await app.close();
    }
  });
});

describe("POST /identity/users/photo/get", () => {
  it("returns 401 when token is missing", async () => {
    const runtime = makeRuntimeStub();
    const app = buildServer(makeEnv(), runtime as unknown as AdapterRuntime);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/identity/users/photo/get",
        payload: {
          target: { mode: "device", deviceId: "dev-1" },
          userId: "u-1"
        }
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("returns current photo payload for valid request", async () => {
    const runtime = makeRuntimeStub([], undefined, undefined, undefined, {
      deviceId: "dev-1",
      userId: "u-1",
      photoData: ["base64-image"],
      photoUrl: ["https://example.test/u-1.jpg"],
      faceData: ["face-template"]
    });
    const app = buildServer(makeEnv(), runtime as unknown as AdapterRuntime);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/identity/users/photo/get",
        headers: {
          authorization: "Bearer backfill-token"
        },
        payload: {
          target: { mode: "device", deviceId: "dev-1" },
          userId: "u-1"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        data: {
          photo: {
            deviceId: "dev-1",
            userId: "u-1",
            photoData: ["base64-image"],
            photoUrl: ["https://example.test/u-1.jpg"],
            faceData: ["face-template"]
          }
        }
      });
    } finally {
      await app.close();
    }
  });
});

describe("POST /identity/users/update", () => {
  it("returns per-device partial failure results", async () => {
    const runtime = makeRuntimeStub([], undefined, undefined, [
      {
        deviceId: "dev-1",
        operation: "update",
        status: "failed",
        steps: {
          accessUser: "success",
          accessCard: "failed",
          accessFace: "skipped"
        },
        errorCode: "identity_write_failed",
        errorMessage: "card write failed"
      }
    ]);
    const app = buildServer(makeEnv(), runtime as unknown as AdapterRuntime);

    try {
      const response = await app.inject({
        method: "POST",
        url: "/identity/users/update",
        headers: {
          authorization: "Bearer backfill-token"
        },
        payload: {
          target: { mode: "device", deviceId: "dev-1" },
          person: {
            userId: "u-1",
            displayName: "User 1",
            card: {
              cardNo: "C-1"
            }
          }
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        success: true,
        data: {
          results: [
            {
              deviceId: "dev-1",
              operation: "update",
              status: "failed",
              steps: {
                accessUser: "success",
                accessCard: "failed",
                accessFace: "skipped"
              },
              errorCode: "identity_write_failed",
              errorMessage: "card write failed"
            }
          ]
        }
      });
    } finally {
      await app.close();
    }
  });
});

function makeRuntimeStub(
  matches: Array<{ terminalPersonId: string | null; score: number | null; rawPayload: string | null; displayName?: string | null; source?: "accessUser" | "accessCard"; userType?: string | null }> = [],
  exportPayload?: {
    view: "flat";
    users: Array<Record<string, unknown>>;
    devices: Array<Record<string, unknown>>;
  },
  createResults: Array<Record<string, unknown>> = [],
  updateResults: Array<Record<string, unknown>> = [],
  photoPayload?: Record<string, unknown>,
  bulkCreateResults: Array<Record<string, unknown>> = []
) {
  const calls: Array<{ deviceId: string; identityKey: string; identityValue: string; limit: number }> = [];
  return {
    calls,
    async backfill() {
      return [];
    },
    async findIdentity(input: {
      deviceId: string;
      identityKey: string;
      identityValue: string;
      limit: number;
    }) {
      calls.push(input);
      return matches;
    },
    async exportIdentityUsers() {
      return exportPayload ?? {
        view: "flat",
        users: [],
        devices: []
      };
    },
    async createIdentityUser() {
      return createResults;
    },
    async getIdentityUserPhoto() {
      return photoPayload ?? {
        deviceId: "dev-1",
        userId: "u-1",
        photoData: null,
        photoUrl: null,
        faceData: null
      };
    },
    async updateIdentityUser() {
      return updateResults;
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
