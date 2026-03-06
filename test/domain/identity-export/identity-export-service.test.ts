import pino from "pino";
import { describe, expect, it } from "vitest";
import type { AdapterAssignment } from "../../../src/contracts/device-service.js";
import { IdentityExportService } from "../../../src/domain/identity-export/identity-export-service.js";
import type { DahuaClientFactory } from "../../../src/app/dahua-client-factory.js";
import type { AccessCardRecord, AccessUserRecord } from "../../../src/infra/dahua/dahua-client.js";

describe("IdentityExportService", () => {
  it("exports flat users for one device", async () => {
    const assignment = makeAssignment("dev-1");
    const service = new IdentityExportService(
      makeAssignments([assignment]),
      makeClientFactory({
        "dev-1": {
          users: [{ UserID: "u-1", UserName: "User 1", UserType: "0" }],
          cards: [{ UserID: "u-1", CardNo: "C-1", CardName: "Card 1" }]
        }
      }) as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    const response = await service.exportUsers({
      target: { mode: "device", deviceId: "dev-1" },
      view: "flat",
      limit: 10,
      offset: 0,
      includeCards: true
    });

    expect(response.view).toBe("flat");
    if (response.view !== "flat") {
      throw new Error("unexpected response view");
    }
    expect(response.users).toHaveLength(1);
    expect(response.users[0]).toMatchObject({
      deviceId: "dev-1",
      terminalPersonId: "u-1",
      displayName: "User 1",
      cardNo: "C-1",
      sourceSummary: ["accessUser", "accessCard"]
    });
  });

  it("exports grouped users and preserves device failures", async () => {
    const assignments = [makeAssignment("dev-1"), makeAssignment("dev-2")];
    const service = new IdentityExportService(
      makeAssignments(assignments),
      makeClientFactory({
        "dev-1": {
          users: [{ UserID: "u-1", UserName: "User 1" }]
        },
        "dev-2": {
          failUsers: new Error("cgi status 500: failure")
        }
      }) as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    const response = await service.exportUsers({
      target: { mode: "devices", deviceIds: ["dev-1", "dev-2"] },
      view: "grouped",
      limit: 10,
      offset: 0,
      includeCards: false
    });

    expect(response.view).toBe("grouped");
    if (response.view !== "grouped") {
      throw new Error("unexpected response view");
    }
    expect(response.devices).toHaveLength(2);
    expect(response.devices[0]).toMatchObject({
      deviceId: "dev-1",
      exportedCount: 1,
      failed: false
    });
    expect(response.devices[1]).toMatchObject({
      deviceId: "dev-2",
      exportedCount: 0,
      failed: true,
      errorCode: "identity_export_failed"
    });
  });
});

function makeAssignment(deviceId: string): AdapterAssignment {
  return {
    deviceId,
    direction: "IN",
    settingsJson: JSON.stringify({
      protocol: "http",
      host: "127.0.0.1",
      username: "admin",
      password: "admin",
      pushAuth: {
        username: "push-user",
        password: "push-pass"
      },
      channel: 0,
      eventCodes: ["AccessControl"],
      recordBackfillEnabled: true,
      backfillLookbackHours: 24,
      backfillQueryLimit: 300,
      identityQueryMappings: {},
      timePolicy: {
        mode: "boundedDevice",
        maxDriftMs: 60000
      }
    }),
    lastAckedEventId: null
  };
}

function makeAssignments(items: AdapterAssignment[]) {
  return {
    get(deviceId: string) {
      return items.find((item) => item.deviceId === deviceId) ?? null;
    },
    all() {
      return items;
    }
  };
}

function makeClientFactory(options: Record<string, {
  users?: AccessUserRecord[];
  cards?: AccessCardRecord[];
  failUsers?: Error;
}>) {
  return {
    create(assignment: AdapterAssignment) {
      const config = options[assignment.deviceId] ?? {};
      return {
        client: {
          async connect() {
            return;
          },
          async close() {
            return;
          },
          async findAccessUsers() {
            if (config.failUsers) {
              throw config.failUsers;
            }
            return config.users ?? [];
          },
          async findAccessCards() {
            return config.cards ?? [];
          }
        }
      };
    }
  };
}
