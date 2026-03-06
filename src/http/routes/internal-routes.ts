import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { AppEnv } from "../../config/env.js";
import type { AdapterRuntime } from "../../app/adapter-runtime.js";
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

const IdentityTargetSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("device"),
    deviceId: z.string().min(1)
  }),
  z.object({
    mode: z.literal("devices"),
    deviceIds: z.array(z.string().min(1)).min(1)
  }),
  z.object({
    mode: z.literal("allAssigned")
  })
]);

const IdentityDeviceTargetSchema = z.object({
  mode: z.literal("device"),
  deviceId: z.string().min(1)
});

const IdentityExportUsersSchema = z.object({
  target: IdentityTargetSchema,
  view: z.enum(["flat", "grouped"]).default("flat"),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().min(0).default(0),
  includeCards: z.boolean().default(true)
});

const IdentityWriteSchema = z.object({
  target: IdentityTargetSchema,
  person: z.object({
    userId: z.string().min(1),
    displayName: z.string().min(1),
    userType: z.number().int().nullable().default(null),
    userStatus: z.number().int().nullable().default(null),
    authority: z.number().int().nullable().default(null),
    citizenIdNo: z.string().min(1).nullable().default(null),
    password: z.string().min(1).nullable().default(null),
    useTime: z.number().int().nullable().default(null),
    isFirstEnter: z.boolean().nullable().default(null),
    firstEnterDoors: z.array(z.number().int()).nullable().default(null),
    doors: z.array(z.number().int()).nullable().default(null),
    timeSections: z.array(z.number().int()).nullable().default(null),
    specialDaysSchedule: z.array(z.number().int()).nullable().default(null),
    validFrom: z.string().min(1).nullable().default(null),
    validTo: z.string().min(1).nullable().default(null),
    card: z.object({
      cardNo: z.string().min(1),
      cardName: z.string().min(1).nullable().default(null),
      cardType: z.number().int().nullable().default(null),
      cardStatus: z.number().int().nullable().default(null)
    }).nullable().default(null),
    face: z.object({
      photosBase64: z.array(z.string().min(1)).nullable().default(null),
      photoUrls: z.array(z.string().min(1)).nullable().default(null)
    }).nullable().default(null)
  })
});

const IdentityBulkCreateSchema = z.object({
  target: IdentityTargetSchema,
  persons: z.array(IdentityWriteSchema.shape.person).min(1)
});

const IdentityPhotoGetSchema = z.object({
  target: IdentityDeviceTargetSchema,
  userId: z.string().min(1)
});

export function registerInternalRoutes(app: FastifyInstance, env: AppEnv, runtime: AdapterRuntime): void {
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
    } catch (error) {
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
      const payload = await runtime.exportIdentityUsers(parsed.data);
      return reply.send(ok(payload));
    } catch (error) {
      if (error instanceof IdentityFindError) {
        return reply.code(error.statusCode).send(fail("identity_export_error", error.message));
      }
      throw error;
    }
  });

  app.post("/identity/users/photo/get", async (request, reply) => {
    if (!isBearerAuthorized(request.headers.authorization, env.BACKFILL_BEARER_TOKEN)) {
      return reply.code(401).send(fail("unauthorized", "unauthorized"));
    }

    const parsed = IdentityPhotoGetSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(fail("invalid_request", "invalid identity photo get request"));
    }

    try {
      const photo = await runtime.getIdentityUserPhoto(parsed.data);
      return reply.send(ok({ photo }));
    } catch (error) {
      if (error instanceof IdentityFindError) {
        return reply.code(error.statusCode).send(fail("identity_photo_get_error", error.message));
      }
      throw error;
    }
  });

  app.post("/identity/users/create", async (request, reply) => {
    return handleIdentityWrite(request.body, request.headers.authorization, env, reply, runtime.createIdentityUser.bind(runtime), "identity_create_error");
  });

  app.post("/identity/users/update", async (request, reply) => {
    return handleIdentityWrite(request.body, request.headers.authorization, env, reply, runtime.updateIdentityUser.bind(runtime), "identity_update_error");
  });

  app.post("/identity/users/bulk-create", async (request, reply) => {
    return handleIdentityBulkCreate(
      request.body,
      request.headers.authorization,
      env,
      reply,
      runtime.bulkCreateIdentityUsers.bind(runtime)
    );
  });
}

async function handleIdentityWrite(
  body: unknown,
  authorization: string | undefined,
  env: AppEnv,
  reply: FastifyReply,
  action: (input: z.infer<typeof IdentityWriteSchema>) => Promise<unknown>,
  errorCode: string
) {
  if (!isBearerAuthorized(authorization, env.BACKFILL_BEARER_TOKEN)) {
    return reply.code(401).send(fail("unauthorized", "unauthorized"));
  }

  const parsed = IdentityWriteSchema.safeParse(body);
  if (!parsed.success) {
    return reply.code(400).send(fail("invalid_request", "invalid identity write request"));
  }

  try {
    const results = await action(parsed.data);
    return reply.send(ok({ results }));
  } catch (error) {
    if (error instanceof IdentityFindError) {
      return reply.code(error.statusCode).send(fail(errorCode, error.message));
    }
    throw error;
  }
}

async function handleIdentityBulkCreate(
  body: unknown,
  authorization: string | undefined,
  env: AppEnv,
  reply: FastifyReply,
  action: (input: z.infer<typeof IdentityBulkCreateSchema>) => Promise<unknown>
) {
  if (!isBearerAuthorized(authorization, env.BACKFILL_BEARER_TOKEN)) {
    return reply.code(401).send(fail("unauthorized", "unauthorized"));
  }

  const parsed = IdentityBulkCreateSchema.safeParse(body);
  if (!parsed.success) {
    return reply.code(400).send(fail("invalid_request", "invalid identity bulk create request"));
  }

  try {
    const results = await action(parsed.data);
    return reply.send(ok({ results }));
  } catch (error) {
    if (error instanceof IdentityFindError) {
      return reply.code(error.statusCode).send(fail("identity_bulk_create_error", error.message));
    }
    throw error;
  }
}
