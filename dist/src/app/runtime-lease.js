import { DEVICE_SETTINGS_SCHEMA_VERSION, deviceSettingsSchema } from "../domain/devices/device-settings-schema.js";
const REGISTER_RETRY_BASE_MS = 1000;
const REGISTER_RETRY_MAX_MS = 30000;
export async function registerWithRetry(input) {
    let attempts = 0;
    while (input.isRunning()) {
        try {
            return await input.dsClient.register({
                vendorKey: input.env.VENDOR_KEY,
                instanceKey: input.env.ADAPTER_INSTANCE_KEY,
                instanceName: input.env.ADAPTER_INSTANCE_NAME,
                version: input.env.ADAPTER_VERSION,
                capabilities: ["realtime_push", "fetchEvents", "access_control", "identity_find"],
                baseUrl: input.env.BASE_URL,
                retentionMs: input.env.RETENTION_MS,
                deviceSettingsSchema,
                deviceSettingsSchemaVersion: DEVICE_SETTINGS_SCHEMA_VERSION
            });
        }
        catch (error) {
            attempts += 1;
            const delayMs = Math.min(REGISTER_RETRY_BASE_MS * 2 ** Math.min(attempts - 1, 8), REGISTER_RETRY_MAX_MS);
            input.logger.warn({ err: error, attempts, delayMs }, "register failed, retrying");
            await sleep(delayMs);
        }
    }
    throw new Error("adapter runtime stopped before register succeeded");
}
export function shouldReRegister(error) {
    if (!error || typeof error !== "object") {
        return false;
    }
    const asError = error;
    const code = typeof asError.code === "string" ? asError.code : "";
    const message = typeof asError.message === "string" ? asError.message.toLowerCase() : "";
    const statusCode = typeof asError.statusCode === "number" ? asError.statusCode : undefined;
    if (code === "adapter_inactive" || code === "adapter_not_found" || code === "adapter_unknown") {
        return true;
    }
    if (statusCode === 409 && message.includes("adapter_inactive")) {
        return true;
    }
    if (statusCode === 409 && message.includes("adapter is not active")) {
        return true;
    }
    return false;
}
function sleep(delayMs) {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
}
