import { describe, expect, it, vi } from "vitest";
import { DahuaClient } from "../../../src/infra/dahua/dahua-client.js";

describe("DahuaClient", () => {
  it("returns an empty face list when the device reports no face photo", async () => {
    const client = new DahuaClient({
      protocol: "http",
      host: "127.0.0.1",
      port: 80,
      username: "admin",
      password: "admin",
      rejectUnauthorized: false,
      requestTimeoutMs: 1000
    });

    const sendCgiRequest = vi.fn().mockRejectedValue(new Error("cgi status 404: Error"));
    (client as unknown as { sendCgiRequest: typeof sendCgiRequest }).sendCgiRequest = sendCgiRequest;

    await expect(client.findAccessFaces({ userIds: ["u-1"] })).resolves.toEqual([]);
    expect(sendCgiRequest).toHaveBeenCalledOnce();
  });

  it("returns an empty face list when the device reports no photo as bad request", async () => {
    const client = new DahuaClient({
      protocol: "http",
      host: "127.0.0.1",
      port: 80,
      username: "admin",
      password: "admin",
      rejectUnauthorized: false,
      requestTimeoutMs: 1000
    });

    const sendCgiRequest = vi.fn().mockRejectedValue(new Error("cgi status 400: Error\r\nBad Request!\r\n"));
    (client as unknown as { sendCgiRequest: typeof sendCgiRequest }).sendCgiRequest = sendCgiRequest;

    await expect(client.findAccessFaces({ userIds: ["u-1"] })).resolves.toEqual([]);
    expect(sendCgiRequest).toHaveBeenCalledOnce();
  });

  it("keeps propagating unrelated face lookup errors", async () => {
    const client = new DahuaClient({
      protocol: "http",
      host: "127.0.0.1",
      port: 80,
      username: "admin",
      password: "admin",
      rejectUnauthorized: false,
      requestTimeoutMs: 1000
    });

    const sendCgiRequest = vi.fn().mockRejectedValue(new Error("cgi status 500: internal error"));
    (client as unknown as { sendCgiRequest: typeof sendCgiRequest }).sendCgiRequest = sendCgiRequest;

    await expect(client.findAccessFaces({ userIds: ["u-1"] })).rejects.toThrow("cgi status 500: internal error");
  });
});
