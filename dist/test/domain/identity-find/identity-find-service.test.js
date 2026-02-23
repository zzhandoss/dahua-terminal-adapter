import pino from "pino";
import { describe, expect, it } from "vitest";
import { IdentityFindService } from "../../../src/domain/identity-find/identity-find-service.js";
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
        const service = new IdentityFindService({ get: () => assignment }, clientFactory, pino({ level: "silent" }));
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
        const service = new IdentityFindService({ get: () => assignment }, clientFactory, pino({ level: "silent" }));
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
        const service = new IdentityFindService({ get: () => assignment }, clientFactory, pino({ level: "silent" }));
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
        const service = new IdentityFindService({ get: () => assignment }, makeClientFactory({
            failUsers: new Error("cgi status 500: Internal Server Error")
        }), pino({ level: "silent" }));
        await expect(service.find({
            deviceId: "dev-1",
            identityKey: "terminalPersonId",
            identityValue: "u-1",
            limit: 1
        })).rejects.toMatchObject({ statusCode: 502 });
    });
    it("throws 422 for unknown identity key", async () => {
        const service = new IdentityFindService({ get: () => makeAssignment() }, makeClientFactory({}), pino({ level: "silent" }));
        await expect(service.find({
            deviceId: "dev-1",
            identityKey: "unknown",
            identityValue: "value",
            limit: 1
        })).rejects.toMatchObject({ statusCode: 422 });
    });
    it("throws 404 for missing assignment", async () => {
        const service = new IdentityFindService({ get: () => null }, makeClientFactory({}), pino({ level: "silent" }));
        await expect(service.find({
            deviceId: "missing-device",
            identityKey: "terminalPersonId",
            identityValue: "value",
            limit: 1
        })).rejects.toMatchObject({ statusCode: 404 });
    });
    it("includes displayName from AccessUser payload", async () => {
        const assignment = makeAssignment({
            paramsTemplate: {
                "accessUser.Condition.UserID": "{{identityValue}}"
            }
        });
        const service = new IdentityFindService({ get: () => assignment }, makeClientFactory({
            users: [{ UserID: "u-42", UserName: "Alice" }]
        }), pino({ level: "silent" }));
        const matches = await service.find({
            deviceId: "dev-1",
            identityKey: "terminalPersonId",
            identityValue: "u-42",
            limit: 1
        });
        expect(matches[0]?.displayName).toBe("Alice");
        expect(matches[0]?.source).toBe("accessUser");
    });
    it("exports users with optional cards", async () => {
        const assignment = makeAssignment();
        const service = new IdentityFindService({ get: () => assignment }, makeClientFactory({
            users: [{ UserID: "u-1", UserName: "User 1", UserType: "0" }],
            cards: [{ UserID: "u-2", CardNo: "C-2", CardName: "Card 2" }]
        }), pino({ level: "silent" }));
        const users = await service.exportUsers({
            deviceId: "dev-1",
            limit: 10,
            offset: 0,
            includeCards: true
        });
        expect(users).toHaveLength(2);
        expect(users[0]).toMatchObject({
            terminalPersonId: "u-1",
            displayName: "User 1",
            source: "accessUser"
        });
        expect(users[1]).toMatchObject({
            terminalPersonId: "u-2",
            cardNo: "C-2",
            source: "accessCard"
        });
    });
});
function makeAssignment(options) {
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
function makeClientFactory(options) {
    const calls = [];
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
