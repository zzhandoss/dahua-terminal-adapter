import { z } from "zod";
import { normalizeAccessControlEvent } from "../domain/events/access-control-ingest.js";
import { DahuaClient } from "../infra/dahua/dahua-client.js";
import { toDahuaConnectionConfig } from "../domain/devices/device-settings.js";
import { fail, ok } from "./http-envelope.js";
import { buildDevUiHtml } from "./dev-ui-page.js";
const EmitAccessEventSchema = z.object({
    deviceId: z.string().min(1),
    recNo: z.number().int().positive().optional(),
    userId: z.string().min(1).optional(),
    cardNo: z.string().min(1).optional(),
    type: z.enum(["Entry", "Exit"]).default("Entry"),
    method: z.number().int().nonnegative().default(1),
    status: z.number().int().nonnegative().default(1)
});
const DeviceIdSchema = z.object({
    deviceId: z.string().min(1)
});
const AccessRecordsSchema = z.object({
    deviceId: z.string().min(1),
    lookbackMinutes: z.number().int().positive().max(24 * 60).default(60),
    count: z.number().int().positive().max(1000).default(100)
});
export function registerDevUiRoutes(app, env, runtime) {
    if (env.NODE_ENV !== "development") {
        return;
    }
    app.get("/dev/ui", async (_request, reply) => {
        reply.type("text/html; charset=utf-8").send(buildDevUiHtml());
    });
    app.post("/dev/ui/emit-access-event", async (request, reply) => {
        const parsed = EmitAccessEventSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send(fail("invalid_request", "invalid emit payload", parsed.error.issues.map((issue) => issue.message)));
        }
        const input = parsed.data;
        const settings = runtime.getDeviceSettings(input.deviceId);
        const direction = runtime.getAssignmentDirection(input.deviceId);
        if (!settings) {
            return reply.code(404).send(fail("device_not_found", "device settings not found"));
        }
        if (!direction) {
            return reply.code(404).send(fail("device_assignment_not_found", "device assignment direction not found"));
        }
        const nowMs = Date.now();
        const event = normalizeAccessControlEvent({
            deviceId: input.deviceId,
            direction,
            timePolicy: settings.timePolicy,
            event: {
                Code: "AccessControl",
                Action: "Pulse",
                Index: 0,
                Data: {
                    RecNo: input.recNo ?? Math.floor(nowMs / 1000),
                    UTC: Math.floor(nowMs / 1000),
                    UserID: input.userId ?? null,
                    CardNo: input.cardNo ?? null,
                    Type: input.type,
                    Method: input.method,
                    Status: input.status
                }
            }
        });
        if (!event) {
            return reply.code(422).send(fail("normalize_failed", "failed to normalize event"));
        }
        runtime.ingestEvent(event);
        return reply.send(ok({ accepted: 1, event }));
    });
    app.post("/dev/ui/client/login", async (request, reply) => {
        const parsed = DeviceIdSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send(fail("invalid_request", "invalid payload"));
        }
        const settings = runtime.getDeviceSettings(parsed.data.deviceId);
        if (!settings) {
            return reply.code(404).send(fail("device_not_found", "device settings not found"));
        }
        const startedAt = Date.now();
        const client = new DahuaClient(toDahuaConnectionConfig(settings, {
            requestTimeoutMs: env.HTTP_TIMEOUT_MS,
            rejectUnauthorized: env.REJECT_UNAUTHORIZED
        }));
        try {
            await client.connect();
            await client.healthCheck();
            return reply.send(ok({
                connected: true,
                durationMs: Date.now() - startedAt,
                endpoint: `${settings.protocol}://${settings.host}:${settings.port ?? (settings.protocol === "https" ? 443 : 80)}`
            }));
        }
        catch (error) {
            return reply.code(502).send(fail("dahua_login_failed", error instanceof Error ? error.message : "unknown dahua error"));
        }
        finally {
            await client.close().catch(() => undefined);
        }
    });
    app.post("/dev/ui/client/access-records", async (request, reply) => {
        const parsed = AccessRecordsSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send(fail("invalid_request", "invalid payload"));
        }
        const settings = runtime.getDeviceSettings(parsed.data.deviceId);
        if (!settings) {
            return reply.code(404).send(fail("device_not_found", "device settings not found"));
        }
        const nowSec = Math.floor(Date.now() / 1000);
        const client = new DahuaClient(toDahuaConnectionConfig(settings, {
            requestTimeoutMs: env.HTTP_TIMEOUT_MS,
            rejectUnauthorized: env.REJECT_UNAUTHORIZED
        }));
        try {
            await client.connect();
            const records = await client.findAccessControlRecords({
                startTimeUtcSec: nowSec - parsed.data.lookbackMinutes * 60,
                endTimeUtcSec: nowSec,
                count: parsed.data.count
            });
            return reply.send(ok({ total: records.length, records }));
        }
        catch (error) {
            return reply.code(502).send(fail("dahua_records_failed", error instanceof Error ? error.message : "unknown dahua error"));
        }
        finally {
            await client.close().catch(() => undefined);
        }
    });
}
