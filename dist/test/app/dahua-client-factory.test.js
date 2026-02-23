import { describe, expect, it } from "vitest";
import { DahuaClientFactory } from "../../src/app/dahua-client-factory.js";
import { MockDahuaClient } from "../../src/infra/mock/mock-dahua-client.js";
import { MockPersonStore } from "../../src/infra/mock/person-store.js";
describe("DahuaClientFactory", () => {
    it("creates mock client when global and device mock flags are enabled", () => {
        const factory = new DahuaClientFactory({
            requestTimeoutMs: 1000,
            rejectUnauthorized: false,
            mockEnabled: true
        }, new MockPersonStore());
        const context = factory.create(makeAssignment({ mockEnabled: true }));
        expect(context.client).toBeInstanceOf(MockDahuaClient);
    });
});
function makeAssignment(options) {
    return {
        deviceId: "dev-1",
        direction: "IN",
        lastAckedEventId: null,
        settingsJson: JSON.stringify({
            protocol: "http",
            host: "127.0.0.1",
            port: 80,
            username: "admin",
            password: "admin",
            pushAuth: {
                username: "push-user",
                password: "push-pass",
                token: "push-token"
            },
            channel: 0,
            eventCodes: ["AccessControl"],
            recordBackfillEnabled: true,
            backfillLookbackHours: 24,
            backfillQueryLimit: 300,
            mockEnabled: options.mockEnabled,
            mockIdentityKey: "accessUser.Condition.CitizenIDNo",
            identityQueryMappings: {
                iin: {
                    provider: "dahua.accessControlIdentity",
                    sources: ["accessUser", "accessCard"],
                    paramsTemplate: {
                        "accessUser.Condition.CitizenIDNo": "{{identityValue}}"
                    }
                }
            }
        })
    };
}
