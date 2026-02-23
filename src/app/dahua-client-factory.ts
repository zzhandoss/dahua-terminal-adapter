import type { AdapterAssignment } from "../contracts/device-service.js";
import { DahuaClient } from "../infra/dahua/dahua-client.js";
import type { VendorDeviceClient } from "../infra/vendor/vendor-device-client.js";
import { MockDahuaClient } from "../infra/mock/mock-dahua-client.js";
import { MockPersonStore } from "../infra/mock/person-store.js";
import {
  parseDahuaSettings,
  toDahuaConnectionConfig,
  type DahuaDeviceSettings
} from "../domain/devices/device-settings.js";

export type DahuaClientContext = {
  client: VendorDeviceClient;
  settings: DahuaDeviceSettings;
};

export class DahuaClientFactory {
  constructor(
    private readonly defaults: {
      requestTimeoutMs: number;
      rejectUnauthorized: boolean;
      mockEnabled: boolean;
    },
    private readonly personStore?: MockPersonStore
  ) {}

  create(assignment: AdapterAssignment): DahuaClientContext {
    const settings = parseDahuaSettings(assignment.settingsJson);
    const client = this.createClient(assignment.deviceId, settings);
    return { client, settings };
  }

  private createClient(deviceId: string, settings: DahuaDeviceSettings): VendorDeviceClient {
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
