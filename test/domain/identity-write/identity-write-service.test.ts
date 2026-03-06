import pino from "pino";
import { describe, expect, it } from "vitest";
import type { AdapterAssignment } from "../../../src/contracts/device-service.js";
import type { DahuaClientFactory } from "../../../src/app/dahua-client-factory.js";
import { IdentityWriteService } from "../../../src/domain/identity-write/identity-write-service.js";
import { IdentityFindError } from "../../../src/domain/identity-find/identity-find-service.js";

describe("IdentityWriteService", () => {
  it("creates user, card and face on a device", async () => {
    const factory = makeClientFactory({});
    const service = new IdentityWriteService(
      makeAssignments([makeAssignment("dev-1")]),
      factory as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    const results = await service.create({
      target: { mode: "device", deviceId: "dev-1" },
      person: {
        userId: "u-1",
        displayName: "User 1",
        userType: 0,
        userStatus: 0,
        authority: 1,
        citizenIdNo: "900101000001",
        password: null,
        useTime: null,
        isFirstEnter: null,
        firstEnterDoors: null,
        doors: null,
        timeSections: null,
        specialDaysSchedule: null,
        validFrom: null,
        validTo: null,
        card: {
          cardNo: "C-1",
          cardName: null,
          cardType: 0,
          cardStatus: 0
        },
        face: {
          photosBase64: ["base64"],
          photoUrls: null
        }
      }
    });

    expect(results).toEqual([
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
    expect(factory.calls).toEqual(["createAccessUser", "createAccessCard", "createAccessFace"]);
  });

  it("returns partial failure for one device during fan-out", async () => {
    const factory = makeClientFactory({
      "dev-2:updateAccessCard": new Error("card write failed")
    });
    const service = new IdentityWriteService(
      makeAssignments([makeAssignment("dev-1"), makeAssignment("dev-2")]),
      factory as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    const results = await service.update({
      target: { mode: "devices", deviceIds: ["dev-1", "dev-2"] },
      person: {
        userId: "u-1",
        displayName: "User 1",
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
        card: {
          cardNo: "C-1",
          cardName: null,
          cardType: null,
          cardStatus: null
        },
        face: null
      }
    });

    expect(results[0]).toMatchObject({
      deviceId: "dev-1",
      status: "success",
      steps: {
        accessUser: "success",
        accessCard: "success",
        accessFace: "skipped"
      }
    });
    expect(results[1]).toMatchObject({
      deviceId: "dev-2",
      status: "failed",
      steps: {
        accessUser: "success",
        accessCard: "failed",
        accessFace: "skipped"
      },
      errorCode: "identity_write_failed",
      errorMessage: "card write failed"
    });
  });

  it("rejects invalid face payload", async () => {
    const service = new IdentityWriteService(
      makeAssignments([makeAssignment("dev-1")]),
      makeClientFactory({}) as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    await expect(
      service.create({
        target: { mode: "device", deviceId: "dev-1" },
        person: {
          userId: "u-1",
          displayName: "User 1",
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
          face: {
            photosBase64: null,
            photoUrls: null
          }
        }
      })
    ).rejects.toMatchObject({ statusCode: 422 } satisfies Partial<IdentityFindError>);
  });

  it("creates face during update when device has no existing face record", async () => {
    const factory = makeClientFactory({});
    const service = new IdentityWriteService(
      makeAssignments([makeAssignment("dev-1")]),
      factory as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    const results = await service.update({
      target: { mode: "device", deviceId: "dev-1" },
      person: {
        userId: "u-1",
        displayName: "User 1",
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
        face: {
          photosBase64: ["base64"],
          photoUrls: null
        }
      }
    });

    expect(results).toEqual([
      {
        deviceId: "dev-1",
        operation: "update",
        status: "success",
        steps: {
          accessUser: "success",
          accessCard: "skipped",
          accessFace: "success"
        }
      }
    ]);
    expect(factory.calls).toEqual(["updateAccessUser", "findAccessFaces", "createAccessFace"]);
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

function makeClientFactory(failures: Record<string, Error>) {
  const calls: string[] = [];
  return {
    calls,
    create(assignment: AdapterAssignment) {
      const fail = (method: string) => {
        const key = `${assignment.deviceId}:${method}`;
        const error = failures[key];
        if (error) {
          throw error;
        }
      };
      return {
        client: {
          async connect() {
            return;
          },
          async close() {
            return;
          },
          async findAccessFaces() {
            calls.push("findAccessFaces");
            fail("findAccessFaces");
            return [];
          },
          async createAccessUser() {
            calls.push("createAccessUser");
            fail("createAccessUser");
          },
          async updateAccessUser() {
            calls.push("updateAccessUser");
            fail("updateAccessUser");
          },
          async createAccessCard() {
            calls.push("createAccessCard");
            fail("createAccessCard");
          },
          async updateAccessCard() {
            calls.push("updateAccessCard");
            fail("updateAccessCard");
          },
          async createAccessFace() {
            calls.push("createAccessFace");
            fail("createAccessFace");
          },
          async updateAccessFace() {
            calls.push("updateAccessFace");
            fail("updateAccessFace");
          }
        }
      };
    }
  };
}
