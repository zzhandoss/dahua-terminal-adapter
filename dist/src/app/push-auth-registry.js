import { parseDahuaSettings } from "../domain/devices/device-settings.js";
export class PushAuthRegistry {
    settingsByDevice = new Map();
    pushAuthByUsername = new Map();
    rebuild(assignments) {
        const failures = [];
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
            }
            catch (error) {
                failures.push({ deviceId: assignment.deviceId, error });
            }
        }
        return failures;
    }
    resolvePushAuth(username) {
        return this.pushAuthByUsername.get(username) ?? null;
    }
    getDeviceSettings(deviceId) {
        return this.settingsByDevice.get(deviceId) ?? null;
    }
}
