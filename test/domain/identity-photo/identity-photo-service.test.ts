import pino from "pino";
import { describe, expect, it } from "vitest";
import type { AdapterAssignment } from "../../../src/contracts/device-service.js";
import type { DahuaClientFactory } from "../../../src/app/dahua-client-factory.js";
import { IdentityPhotoService } from "../../../src/domain/identity-photo/identity-photo-service.js";

describe("IdentityPhotoService", () => {
  it("returns current photo for one device and user", async () => {
    const service = new IdentityPhotoService(
      makeAssignments([makeAssignment("dev-1")]),
      makeClientFactory({
        "dev-1": [
          {
            UserID: "u-1",
            PhotoData: ["base64-image"],
            PhotoURL: ["https://example.test/u-1.jpg"],
            FaceData: ["face-template"]
          }
        ]
      }) as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    const result = await service.getPhoto({
      target: { mode: "device", deviceId: "dev-1" },
      userId: "u-1"
    });

    expect(result).toEqual({
      deviceId: "dev-1",
      userId: "u-1",
      photoData: ["base64-image"],
      photoUrl: ["https://example.test/u-1.jpg"],
      faceData: ["face-template"]
    });
  });

  it("returns 404 when face record is absent", async () => {
    const service = new IdentityPhotoService(
      makeAssignments([makeAssignment("dev-1")]),
      makeClientFactory({ "dev-1": [] }) as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    await expect(
      service.getPhoto({
        target: { mode: "device", deviceId: "dev-1" },
        userId: "missing"
      })
    ).rejects.toMatchObject({ statusCode: 404 });
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
    }
  };
}

function makeClientFactory(facesByDevice: Record<string, Array<Record<string, unknown>>>) {
  return {
    create(assignment: AdapterAssignment) {
      return {
        client: {
          async connect() {
            return;
          },
          async close() {
            return;
          },
          async findAccessFaces() {
            return facesByDevice[assignment.deviceId] ?? [];
          }
        }
      };
    }
  };
}
