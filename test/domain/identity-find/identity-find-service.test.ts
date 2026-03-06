import pino from "pino";
import { describe, expect, it } from "vitest";
import type { AdapterAssignment } from "../../../src/contracts/device-service.js";
import { IdentityFindError, IdentityFindService } from "../../../src/domain/identity-find/identity-find-service.js";
import type { DahuaClientFactory } from "../../../src/app/dahua-client-factory.js";
import type { AccessCardRecord, AccessUserRecord } from "../../../src/infra/dahua/dahua-client.js";

describe("IdentityFindService", () => {
  it("returns matches from accessUser for exact identity value", async () => {
    const assignment = makeAssignment({
      paramsTemplate: {
        "accessUser.Condition.CitizenIDNo": "{{identityValue}}"
      }
    });
    const clientFactory = makeClientFactory({
      users: [{ UserID: "u-1", CitizenIDNo: "123456789012" }, { UserID: "u-2", CitizenIDNo: "999" }]
    });
    const service = new IdentityFindService(
      { get: () => assignment },
      clientFactory as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    const matches = await service.find({
      deviceId: "dev-1",
      identityKey: "terminalPersonId",
      identityValue: "123456789012",
      limit: 10
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.terminalPersonId).toBe("u-1");
    expect(matches[0]?.displayName).toBeNull();
    expect(matches[0]?.source).toBe("accessUser");
    expect(clientFactory.calls).toEqual([
      {
        source: "accessUser",
        condition: { CitizenIDNo: "123456789012" },
        limit: 10
      }
    ]);
  });

  it("falls back to accessCard when accessUser has no matches", async () => {
    const assignment = makeAssignment({
      paramsTemplate: {
        "accessUser.Condition.UserID": "{{identityValue}}",
        "accessCard.Condition.CardNo": "{{identityValue}}"
      }
    });
    const clientFactory = makeClientFactory({
      users: [],
      cards: [{ UserID: "u-card-1", CardNo: "CARD-001" }]
    });
    const service = new IdentityFindService(
      { get: () => assignment },
      clientFactory as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    const matches = await service.find({
      deviceId: "dev-1",
      identityKey: "terminalPersonId",
      identityValue: "CARD-001",
      limit: 1
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.terminalPersonId).toBe("u-card-1");
    expect(clientFactory.calls.map((item) => item.source)).toEqual(["accessUser", "accessCard"]);
  });

  it("continues to next source when accessUser returns 404", async () => {
    const assignment = makeAssignment({
      paramsTemplate: {
        "accessUser.Condition.UserID": "{{identityValue}}",
        "accessCard.Condition.CardNo": "{{identityValue}}"
      }
    });
    const clientFactory = makeClientFactory({
      failUsers: new Error("cgi status 404: <html><body><h1>404 Not Found</h1></body></html>"),
      cards: [{ UserID: "u-card-2", CardNo: "CARD-404" }]
    });
    const service = new IdentityFindService(
      { get: () => assignment },
      clientFactory as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    const matches = await service.find({
      deviceId: "dev-1",
      identityKey: "terminalPersonId",
      identityValue: "CARD-404",
      limit: 1
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.terminalPersonId).toBe("u-card-2");
  });

  it("throws 502 on non-404 vendor error", async () => {
    const assignment = makeAssignment({
      paramsTemplate: {
        "accessUser.Condition.UserID": "{{identityValue}}"
      }
    });
    const service = new IdentityFindService(
      { get: () => assignment },
      makeClientFactory({
        failUsers: new Error("cgi status 500: Internal Server Error")
      }) as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    await expect(
      service.find({
        deviceId: "dev-1",
        identityKey: "terminalPersonId",
        identityValue: "u-1",
        limit: 1
      })
    ).rejects.toMatchObject({ statusCode: 502 } satisfies Partial<IdentityFindError>);
  });

  it("throws 422 for unknown identity key", async () => {
    const service = new IdentityFindService(
      { get: () => makeAssignment() },
      makeClientFactory({}) as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    await expect(
      service.find({
        deviceId: "dev-1",
        identityKey: "unknown",
        identityValue: "value",
        limit: 1
      })
    ).rejects.toMatchObject({ statusCode: 422 } satisfies Partial<IdentityFindError>);
  });

  it("throws 404 for missing assignment", async () => {
    const service = new IdentityFindService(
      { get: () => null },
      makeClientFactory({}) as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    await expect(
      service.find({
        deviceId: "missing-device",
        identityKey: "terminalPersonId",
        identityValue: "value",
        limit: 1
      })
    ).rejects.toMatchObject({ statusCode: 404 } satisfies Partial<IdentityFindError>);
  });

  it("includes displayName from AccessUser payload", async () => {
    const assignment = makeAssignment({
      paramsTemplate: {
        "accessUser.Condition.UserID": "{{identityValue}}"
      }
    });
    const service = new IdentityFindService(
      { get: () => assignment },
      makeClientFactory({
        users: [{ UserID: "u-42", UserName: "Alice" }]
      }) as unknown as DahuaClientFactory,
      pino({ level: "silent" })
    );

    const matches = await service.find({
      deviceId: "dev-1",
      identityKey: "terminalPersonId",
      identityValue: "u-42",
      limit: 1
    });

    expect(matches[0]?.displayName).toBe("Alice");
    expect(matches[0]?.source).toBe("accessUser");
  });
});

function makeAssignment(options?: {
  sources?: Array<"accessUser" | "accessCard">;
  paramsTemplate?: Record<string, string>;
}): AdapterAssignment {
  return {
    deviceId: "dev-1",
    direction: "IN",
    settingsJson: JSON.stringify({
      protocol: "http",
      host: "127.0.0.1",
      port: 80,
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
      identityQueryMappings: {
        terminalPersonId: {
          provider: "dahua.accessControlIdentity",
          sources: options?.sources ?? ["accessUser", "accessCard"],
          paramsTemplate: options?.paramsTemplate ?? {
            "accessUser.Condition.UserID": "{{identityValue}}"
          }
        }
      }
    }),
    lastAckedEventId: null
  };
}

function makeClientFactory(options: {
  users?: AccessUserRecord[];
  cards?: AccessCardRecord[];
  failUsers?: Error;
  failCards?: Error;
}): {
  calls: Array<{ source: "accessUser" | "accessCard"; condition: Record<string, string>; limit: number }>;
  create: () => {
    client: {
      connect: () => Promise<void>;
      close: () => Promise<void>;
      findAccessUsers: (input: {
        condition: Record<string, string>;
        limit: number;
        offset?: number;
      }) => Promise<AccessUserRecord[]>;
      findAccessCards: (input: {
        condition: Record<string, string>;
        limit: number;
        offset?: number;
      }) => Promise<AccessCardRecord[]>;
    };
  };
} {
  const calls: Array<{ source: "accessUser" | "accessCard"; condition: Record<string, string>; limit: number }> = [];
  return {
    calls,
    create() {
      return {
        client: {
          async connect() {
            return;
          },
          async close() {
            return;
          },
          async findAccessUsers(input) {
            calls.push({ source: "accessUser", condition: input.condition, limit: input.limit });
            if (options.failUsers) {
              throw options.failUsers;
            }
            return options.users ?? [];
          },
          async findAccessCards(input) {
            calls.push({ source: "accessCard", condition: input.condition, limit: input.limit });
            if (options.failCards) {
              throw options.failCards;
            }
            return options.cards ?? [];
          }
        }
      };
    }
  };
}
