import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AdapterRuntime } from "../../app/adapter-runtime.js";
import { fail, ok } from "../http-envelope.js";

const SnapshotSchema = z.object({
  deviceIds: z.array(z.string().min(1)).optional()
});

const KEEPALIVE_UPLOAD_TYPES = new Set(["EventHttpUpload", "PictureHttpUpload", "GeneralHttpUpload"]);

export function registerMonitorRoutes(app: FastifyInstance, runtime: AdapterRuntime): void {
  app.get("/health", async (_request, reply) =>
    reply.send(ok({ status: "ok" }))
  );

  app.get("/:uploadType/keepalive", async (request, reply) => {
    const uploadType = String((request.params as { uploadType?: string }).uploadType ?? "");
    if (!KEEPALIVE_UPLOAD_TYPES.has(uploadType)) {
      return reply.code(404).send(fail("not_found", "route not found"));
    }
    return reply
      .code(200)
      .header("content-type", "text/plain; charset=utf-8")
      .send("OK");
  });

  app.get("/metrics", async (_request, reply) => {
    return reply
      .code(200)
      .header("content-type", "text/plain; version=0.0.4")
      .send(`${runtime.getPrometheusMetrics()}\n`);
  });

  app.get("/monitor/snapshot", async (request, reply) => {
    const parsed = SnapshotSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send(fail("invalid_request", "invalid snapshot query"));
    }
    return reply.send(ok(runtime.getSnapshot(parsed.data)));
  });

  app.post("/monitor/devices", async (request, reply) => {
    const parsed = SnapshotSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send(fail("invalid_request", "invalid monitor request"));
    }
    return reply.send(ok(runtime.getSnapshot(parsed.data)));
  });
}

