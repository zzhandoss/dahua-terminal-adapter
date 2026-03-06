import pino from "pino";
import { describe, expect, it } from "vitest";
import type { AdapterAssignment } from "../../../src/contracts/device-service.js";
import type { DahuaClientFactory } from "../../../src/app/dahua-client-factory.js";
import { IdentityWriteService } from "../../../src/domain/identity-write/identity-write-service.js";

describe("IdentityWriteService bulkCreate", () => {
  it("creates each person on every target device", async () => {
    const factory = makeClientFactory();
    const service = new IdentityWriteService(
      makeAssignments([makeAssignment("dev-1"), makeAssignment("dev-2")]),
      factory as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    const results = await service.bulkCreate({
      target: { mode: "devices", deviceIds: ["dev-1", "dev-2"] },
      persons: [
        makePerson("u-1", "User 1"),
        makePerson("u-2", "User 2")
      ]
    });

    expect(results).toEqual([
      {
        userId: "u-1",
        deviceId: "dev-1",
        operation: "create",
        status: "success",
        steps: { accessUser: "success", accessCard: "skipped", accessFace: "skipped" }
      },
      {
        userId: "u-2",
        deviceId: "dev-1",
        operation: "create",
        status: "success",
        steps: { accessUser: "success", accessCard: "skipped", accessFace: "skipped" }
      },
      {
        userId: "u-1",
        deviceId: "dev-2",
        operation: "create",
        status: "success",
        steps: { accessUser: "success", accessCard: "skipped", accessFace: "skipped" }
      },
      {
        userId: "u-2",
        deviceId: "dev-2",
        operation: "create",
        status: "success",
        steps: { accessUser: "success", accessCard: "skipped", accessFace: "skipped" }
      }
    ]);
    expect(factory.calls.filter((item) => item.startsWith("connect:"))).toEqual(["connect:dev-1", "connect:dev-2"]);
    expect(factory.calls.filter((item) => item.startsWith("close:"))).toEqual(["close:dev-1", "close:dev-2"]);
    expect(factory.calls.filter((item) => item.startsWith("createAccessUser:"))).toEqual([
      "createAccessUser:dev-1:u-1",
      "createAccessUser:dev-1:u-2",
      "createAccessUser:dev-2:u-1",
      "createAccessUser:dev-2:u-2"
    ]);
  });

  it("skips the whole person when user already exists on device", async () => {
    const factory = makeClientFactory({
      existingUsers: ["dev-1:u-1"]
    });
    const service = new IdentityWriteService(
      makeAssignments([makeAssignment("dev-1")]),
      factory as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    const results = await service.bulkCreate({
      target: { mode: "device", deviceId: "dev-1" },
      persons: [
        {
          ...makePerson("u-1", "User 1"),
          card: {
            cardNo: "C-1",
            cardName: null,
            cardType: null,
            cardStatus: null
          },
          face: {
            photosBase64: ["base64"],
            photoUrls: null
          }
        }
      ]
    });

    expect(results).toEqual([
      {
        userId: "u-1",
        deviceId: "dev-1",
        operation: "create",
        status: "skipped",
        steps: { accessUser: "skipped", accessCard: "skipped", accessFace: "skipped" },
        skipCode: "user_already_exists",
        skipMessage: "user already exists on device"
      }
    ]);
    expect(factory.calls).toContain("findAccessUsers:dev-1:u-1");
    expect(factory.calls.some((item) => item.startsWith("createAccessUser:dev-1:u-1"))).toBe(false);
    expect(factory.calls.some((item) => item.startsWith("createAccessCard:dev-1:u-1"))).toBe(false);
    expect(factory.calls.some((item) => item.startsWith("createAccessFace:dev-1:u-1"))).toBe(false);
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

function makePerson(userId: string, displayName: string) {
  return {
    userId,
    displayName,
    userType: null,
    userStatus: null,
    authority: null,
    citizenIdNo: null,
    password: null,
    useTime: null,
    isFirstEnter: null,
    firstEnterDoors: null,
    doors: null,
    timeSections: null,
    specialDaysSchedule: null,
    validFrom: null,
    validTo: null,
    card: null,
    face: null
  };
}

function makeClientFactory(options: { existingUsers?: string[] } = {}) {
  const calls: string[] = [];
  const existingUsers = new Set(options.existingUsers ?? []);

  return {
    calls,
    create(assignment: AdapterAssignment) {
      return {
        client: {
          async connect() {
            calls.push(`connect:${assignment.deviceId}`);
          },
          async close() {
            calls.push(`close:${assignment.deviceId}`);
          },
          async findAccessUsers(input: { condition: Record<string, string> }) {
            const userId = input.condition.UserID ?? "";
            calls.push(`findAccessUsers:${assignment.deviceId}:${userId}`);
            if (existingUsers.has(`${assignment.deviceId}:${userId}`)) {
              return [{ UserID: userId }];
            }
            return [];
          },
          async findAccessCards() {
            return [];
          },
          async findAccessControlRecords() {
            return [];
          },
          async findAccessFaces() {
            return [];
          },
          async createAccessUser(input: { userId: string }) {
            calls.push(`createAccessUser:${assignment.deviceId}:${input.userId}`);
          },
          async updateAccessUser() {
            return;
          },
          async createAccessCard(input: { userId: string }) {
            calls.push(`createAccessCard:${assignment.deviceId}:${input.userId}`);
          },
          async updateAccessCard() {
            return;
          },
          async createAccessFace(input: { userId: string }) {
            calls.push(`createAccessFace:${assignment.deviceId}:${input.userId}`);
          },
          async updateAccessFace() {
            return;
          }
        }
      };
    }
  };
}
