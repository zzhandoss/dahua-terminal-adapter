import { DahuaClient } from "../infra/dahua/dahua-client.js";
import { MockDahuaClient } from "../infra/mock/mock-dahua-client.js";
import { parseDahuaSettings, toDahuaConnectionConfig } from "../domain/devices/device-settings.js";
export class DahuaClientFactory {
    defaults;
    personStore;
    constructor(defaults, personStore) {
        this.defaults = defaults;
        this.personStore = personStore;
    }
    create(assignment) {
        const settings = parseDahuaSettings(assignment.settingsJson);
        const client = this.createClient(assignment.deviceId, settings);
        return { client, settings };
    }
    createClient(deviceId, settings) {
        if (this.defaults.mockEnabled && settings.mockEnabled !== false) {
            if (!this.personStore) {
                throw new Error("mock person store is not configured");
            }
            return new MockDahuaClient({
                identitySelector: settings.mockIdentityKey,
                personStore: this.personStore
            });
        }
        return new DahuaClient(toDahuaConnectionConfig(settings, this.defaults));
    }
}
