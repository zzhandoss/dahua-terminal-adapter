import type { FastifyInstance } from "fastify";
import type { AdapterRuntime } from "../../app/adapter-runtime.js";
import { DigestAuthServer } from "../digest-auth-server.js";
import { authenticateDigestPush } from "../http-auth.js";
import { fail, ok } from "../http-envelope.js";
import { parseEventUploadBody } from "../../infra/dahua/parsers/access-control-push.js";
import { ingestEvents } from "../ingest/ingest-events.js";
import { parseImageEventRequest } from "../ingest/image-event-handler.js";

export function registerIngestRoutes(
  app: FastifyInstance,
  runtime: AdapterRuntime,
  digest: DigestAuthServer
): void {
  app.post("/ingest/event", async (request, reply) => {
    app.log.info(
      {
        path: "/ingest/event",
        headers: {
          authorization: request.headers.authorization ?? null,
          "content-type": request.headers["content-type"] ?? null
        },
        body: request.body
      },
      "ingest event request received"
    );

    const principal = await authenticateDigestPush(request, reply, runtime, digest);
    if (!principal) {
      return;
    }

    const parsed = parseEventUploadBody(request.body);
    if (!parsed) {
      runtime.markIngestFailure();
      return reply.code(400).send(fail("invalid_request", "invalid event upload payload"));
    }

    const accepted = ingestEvents(runtime, principal.deviceId, [parsed], app.log);
    return reply.send(ok({ accepted }));
  });

  app.post("/ingest/image-event", async (request, reply) => {
    app.log.info(
      {
        path: "/ingest/image-event",
        headers: {
          authorization: request.headers.authorization ?? null,
          "content-type": request.headers["content-type"] ?? null,
          "content-length": request.headers["content-length"] ?? null
        }
      },
      "ingest image-event request received"
    );

    const principal = await authenticateDigestPush(request, reply, runtime, digest);
    if (!principal) {
      return;
    }

    const parsed = await parseImageEventRequest(request, app.log);
    if (!parsed.ok) {
      runtime.markIngestFailure();
      return reply.code(parsed.statusCode).send(parsed.payload);
    }

    if (parsed.events.length === 0) {
      return reply.send(ok({ accepted: 0 }));
    }
    const accepted = ingestEvents(runtime, principal.deviceId, parsed.events, app.log);
    return reply.send(ok({ accepted }));
  });
}

