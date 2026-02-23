import { describe, expect, it } from "vitest";
import { DEVICE_SETTINGS_SCHEMA_VERSION, deviceSettingsSchema } from "../../../src/domain/devices/device-settings-schema.js";
describe("deviceSettingsSchema", () => {
    it("exposes a versioned JSON schema with required connection fields", () => {
        expect(DEVICE_SETTINGS_SCHEMA_VERSION).toBe("2.1.0");
        expect(deviceSettingsSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
        expect(deviceSettingsSchema.type).toBe("object");
        expect(deviceSettingsSchema.additionalProperties).toBe(false);
        expect(deviceSettingsSchema.required).toEqual(expect.arrayContaining(["host", "username", "password", "pushAuth", "identityQueryMappings", "timePolicy"]));
    });
    it("defines access identity provider and constrained template keys", () => {
        const schema = deviceSettingsSchema;
        expect(schema.properties.mockIdentityKey.enum).toContain("accessUser.Condition.CitizenIDNo");
        expect(schema.properties.identityQueryMappings.additionalProperties.properties.provider.const).toBe("dahua.accessControlIdentity");
        expect(schema.properties.identityQueryMappings.additionalProperties.properties.sources.default).toEqual([
            "accessUser",
            "accessCard"
        ]);
        expect(schema.properties.identityQueryMappings.additionalProperties.properties.sources.items.enum).toEqual(["accessUser", "accessCard"]);
        expect(schema.properties.identityQueryMappings.additionalProperties.properties.paramsTemplate.type).toBe("object");
        expect(schema.properties.identityQueryMappings.additionalProperties.properties.paramsTemplate.propertyNames.enum).toEqual(expect.arrayContaining([
            "accessUser.Condition.UserID",
            "accessUser.Condition.CitizenIDNo",
            "accessCard.Condition.UserID",
            "accessCard.Condition.CardNo"
        ]));
    });
});
