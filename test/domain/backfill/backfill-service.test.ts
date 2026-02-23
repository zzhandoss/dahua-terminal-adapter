import pino from "pino";
import { describe, expect, it } from "vitest";
import type { AdapterAssignment, NormalizedEvent } from "../../../src/contracts/device-service.js";
import { BackfillService, buildAccessEventId } from "../../../src/domain/backfill/backfill-service.js";
import type { SqliteStore } from "../../../src/infra/store/sqlite-store.js";
import type { DahuaClientFactory } from "../../../src/app/dahua-client-factory.js";

describe("BackfillService", () => {
  it("returns local events when local already satisfies limit", async () => {
    const local = [makeEvent("evt-local-1"), makeEvent("evt-local-2")];
    const service = new BackfillService(
      makeStore(local) as unknown as SqliteStore,
      { get: () => null },
      makeClientFactory([]) as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    const result = await service.fetch({ deviceId: "dev-1", sinceEventId: null, limit: 2 });
    expect(result).toEqual(local);
  });

  it("merges access-control records and uses stable hash event ids", async () => {
    const local = [makeEvent("evt-local-1")];
    const service = new BackfillService(
      makeStore(local) as unknown as SqliteStore,
      { get: () => makeAssignment() },
      makeClientFactory([
        { recNo: 200, createTimeUtcSec: 1700000000, userId: "u-1", cardNo: "c-1", type: "Entry", method: 1, status: 1, raw: { RecNo: "200", UserID: "u-1" } },
        { recNo: 201, createTimeUtcSec: 1700000010, userId: "u-2", cardNo: "c-2", type: "Exit", method: 1, status: 1, raw: { RecNo: "201", UserID: "u-2" } }
      ]) as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    const result = await service.fetch({ deviceId: "dev-1", sinceEventId: null, limit: 3 });
    const expected200 = buildAccessEventId({
      occurredAt: 1700000000 * 1000,
      index: 0,
      data: { RecNo: "200", UserID: "u-1" }
    });
    const expected201 = buildAccessEventId({
      occurredAt: 1700000010 * 1000,
      index: 0,
      data: { RecNo: "201", UserID: "u-2" }
    });
    expect(result.map((item) => item.eventId)).toEqual([
      "evt-local-1",
      expected200,
      expected201
    ]);
  });

  it("returns deterministic hash ids for remote records", async () => {
    const service = new BackfillService(
      makeStore([]) as unknown as SqliteStore,
      { get: () => makeAssignment() },
      makeClientFactory([
        { recNo: 9, createTimeUtcSec: 1700000000, userId: "u-9", cardNo: "c-9", type: "Entry", method: 1, status: 1, raw: { RecNo: "9" } },
        { recNo: 10, createTimeUtcSec: 1700000010, userId: "u-10", cardNo: "c-10", type: "Entry", method: 1, status: 1, raw: { RecNo: "10" } }
      ]) as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    const result = await service.fetch({
      deviceId: "dev-1",
      sinceEventId: "accesscontrol-hash-some-old-id",
      limit: 10
    });
    expect(result).toHaveLength(2);
    expect(result[0]?.eventId.startsWith("accesscontrol-hash-")).toBe(true);
    expect(result[1]?.eventId.startsWith("accesscontrol-hash-")).toBe(true);
    expect(result[0]?.eventId).not.toBe(result[1]?.eventId);
  });
});

function makeEvent(eventId: string): NormalizedEvent {
  return {
    eventId,
    deviceId: "dev-1",
    direction: "IN",
    occurredAt: 1700000000000,
    terminalPersonId: null,
    rawPayload: "{}"
  };
}

function makeAssignment(): AdapterAssignment {
  return {
    deviceId: "dev-1",
    direction: "IN",
    settingsJson: JSON.stringify({
      protocol: "http",
      host: "127.0.0.1",
      port: 80,
      username: "admin",
      password: "admin",
      pushAuth: { username: "push-user", password: "push-pass", token: "push-token" },
      channel: 0,
      eventCodes: ["AccessControl"],
      recordBackfillEnabled: true,
      backfillLookbackHours: 24,
      backfillQueryLimit: 300,
      identityQueryMappings: {
        terminalPersonId: {
          provider: "dahua.accessControlIdentity",
          sources: ["accessUser", "accessCard"],
          paramsTemplate: { "accessUser.Condition.UserID": "{{identityValue}}" }
        }
      },
      timePolicy: { mode: "boundedDevice", maxDriftMs: 60000 }
    }),
    lastAckedEventId: null
  };
}

function makeStore(events: NormalizedEvent[]) {
  return {
    getBackfill(deviceId: string, _sinceEventId: string | null, limit: number) {
      if (deviceId !== "dev-1") {
        return [];
      }
      return events.slice(0, limit);
    }
  };
}

function makeClientFactory(records: Array<{
  recNo: number;
  createTimeUtcSec: number;
  userId: string;
  cardNo: string;
  type: string;
  method: number;
  status: number;
  raw: Record<string, string>;
}>) {
  return {
    create() {
      return {
        client: {
          async connect() {
            return;
          },
          async close() {
            return;
          },
          async findAccessControlRecords() {
            return records;
          }
        }
      };
    }
  };
}
