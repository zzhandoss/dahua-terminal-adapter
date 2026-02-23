import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { DeviceServiceClient, PermanentDeviceServiceError } from "../../../src/infra/ds/device-service-client.js";

type TestServer = {
  close: () => Promise<void>;
  url: string;
};

afterEach(() => {
  // no-op placeholder to keep test lifecycle explicit
});

describe("DeviceServiceClient envelope handling", () => {
  it("unwraps success envelope", async () => {
    const server = await startServer((_req, res) => {
      respondJson(res, 200, {
        success: true,
        data: {
          adapterId: "adapter-1",
          instanceKey: "dahua",
          instanceName: "Dahua Adapter",
          mode: "active",
          heartbeatIntervalMs: 1000,
          batchLimit: 100,
          devices: []
        }
      });
    });

    try {
      const client = new DeviceServiceClient({
        baseUrl: server.url,
        bearerToken: "token",
        hmacSecret: "secret",
        timeoutMs: 5000
      });

      const lease = await client.register({
        vendorKey: "dahua",
        instanceKey: "dahua",
        instanceName: "Dahua Adapter",
        version: "1.0.0",
        capabilities: ["realtime"],
        baseUrl: "http://127.0.0.1:8091",
        retentionMs: 60000
      });

      expect(lease.adapterId).toBe("adapter-1");
    } finally {
      await server.close();
    }
  });

  it("throws PermanentDeviceServiceError for success=false envelope", async () => {
    const server = await startServer((_req, res) => {
      respondJson(res, 200, {
        success: false,
        error: {
          code: "adapter_instance_active",
          message: "instance still active"
        }
      });
    });

    try {
      const client = new DeviceServiceClient({
        baseUrl: server.url,
        bearerToken: "token",
        hmacSecret: "secret",
        timeoutMs: 5000
      });

      await expect(
        client.heartbeat({
          adapterId: "adapter-1"
        })
      ).rejects.toMatchObject({
        code: "adapter_instance_active",
        statusCode: 200
      } satisfies Partial<PermanentDeviceServiceError>);
    } finally {
      await server.close();
    }
  });
});

async function startServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void
): Promise<TestServer> {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to resolve test server address");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  };
}

function respondJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}
