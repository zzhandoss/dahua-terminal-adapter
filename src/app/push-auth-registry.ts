import type { AdapterAssignment } from "../contracts/device-service.js";
import { parseDahuaSettings, type DahuaDeviceSettings } from "../domain/devices/device-settings.js";

export type PushAuthIdentity = {
  deviceId: string;
  username: string;
  password: string;
};

export class PushAuthRegistry {
  private readonly settingsByDevice = new Map<string, DahuaDeviceSettings>();
  private readonly pushAuthByUsername = new Map<string, PushAuthIdentity>();

  rebuild(assignments: AdapterAssignment[]): Array<{ deviceId: string; error: unknown }> {
    const failures: Array<{ deviceId: string; error: unknown }> = [];
    this.settingsByDevice.clear();
    this.pushAuthByUsername.clear();

    for (const assignment of assignments) {
      try {
        const settings = parseDahuaSettings(assignment.settingsJson);
        this.settingsByDevice.set(assignment.deviceId, settings);
        this.pushAuthByUsername.set(settings.pushAuth.username, {
          deviceId: assignment.deviceId,
          username: settings.pushAuth.username,
          password: settings.pushAuth.password
        });
      } catch (error) {
        failures.push({ deviceId: assignment.deviceId, error });
      }
    }
    return failures;
  }

  resolvePushAuth(username: string): PushAuthIdentity | null {
    return this.pushAuthByUsername.get(username) ?? null;
  }

  getDeviceSettings(deviceId: string): DahuaDeviceSettings | null {
    return this.settingsByDevice.get(deviceId) ?? null;
  }
}
