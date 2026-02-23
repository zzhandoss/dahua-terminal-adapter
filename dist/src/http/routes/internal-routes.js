import { z } from "zod";
import { IdentityFindError } from "../../domain/identity-find/identity-find-service.js";
import { isBearerAuthorized } from "../http-auth.js";
import { fail, ok } from "../http-envelope.js";
const BackfillSchema = z.object({
    deviceId: z.string().min(1),
    sinceEventId: z.string().nullable(),
    limit: z.number().int().positive().max(1000)
});
const IdentityFindSchema = z.object({
    deviceId: z.string().min(1),
    identityKey: z.string().min(1),
    identityValue: z.string().min(1),
    limit: z.number().int().positive().max(100).default(1)
});
const IdentityExportUsersSchema = z.object({
    deviceId: z.string().min(1),
    limit: z.number().int().positive().max(1000).default(100),
    offset: z.number().int().min(0).default(0),
    includeCards: z.boolean().default(false)
});
export function registerInternalRoutes(app, env, runtime) {
    app.post("/events/backfill", async (request, reply) => {
        if (!isBearerAuthorized(request.headers.authorization, env.BACKFILL_BEARER_TOKEN)) {
            return reply.code(401).send(fail("unauthorized", "unauthorized"));
        }
        const parsed = BackfillSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send(fail("invalid_request", "invalid backfill request"));
        }
        const events = await runtime.backfill(parsed.data);
        return reply.send(ok({ events }));
    });
    app.post("/identity/find", async (request, reply) => {
        if (!isBearerAuthorized(request.headers.authorization, env.BACKFILL_BEARER_TOKEN)) {
            return reply.code(401).send(fail("unauthorized", "unauthorized"));
        }
        const parsed = IdentityFindSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send(fail("invalid_request", "invalid identity find request"));
        }
        try {
            const matches = await runtime.findIdentity(parsed.data);
            return reply.send(ok({ matches }));
        }
        catch (error) {
            if (error instanceof IdentityFindError) {
                return reply.code(error.statusCode).send(fail("identity_find_error", error.message));
            }
            throw error;
        }
    });
    app.post("/identity/export-users", async (request, reply) => {
        if (!isBearerAuthorized(request.headers.authorization, env.BACKFILL_BEARER_TOKEN)) {
            return reply.code(401).send(fail("unauthorized", "unauthorized"));
        }
        const parsed = IdentityExportUsersSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.code(400).send(fail("invalid_request", "invalid identity export request"));
        }
        try {
            const users = await runtime.exportIdentityUsers(parsed.data);
            return reply.send(ok({ users }));
        }
        catch (error) {
            if (error instanceof IdentityFindError) {
                return reply.code(error.statusCode).send(fail("identity_export_error", error.message));
            }
            throw error;
        }
    });
}
