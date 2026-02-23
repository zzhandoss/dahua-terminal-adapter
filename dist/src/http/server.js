import Fastify from "fastify";
import sensible from "@fastify/sensible";
import { parseBooleanLike } from "../shared/env-parse.js";
import { DigestAuthServer } from "./digest-auth-server.js";
import { registerDevUiRoutes } from "./dev-ui.js";
import { registerIngestRoutes } from "./routes/ingest-routes.js";
import { registerInternalRoutes } from "./routes/internal-routes.js";
import { registerMonitorRoutes } from "./routes/monitor-routes.js";
import { fail } from "./http-envelope.js";
export function buildServer(env, runtime) {
    const app = Fastify({
        logger: buildFastifyLoggerOptions(),
        bodyLimit: 10 * 1024 * 1024
    });
    const digest = new DigestAuthServer(env.PUSH_DIGEST_REALM, env.PUSH_DIGEST_NONCE_TTL_MS);
    app.addContentTypeParser(/^multipart\/x-mixed-replace/i, { parseAs: "buffer" }, (_request, body, done) => {
        done(null, body);
    });
    void app.register(sensible);
    app.addHook("onRequest", async (request, reply) => {
        reply.header("access-control-allow-origin", "*");
        reply.header("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
        reply.header("access-control-allow-headers", "content-type,authorization");
        if (request.method === "OPTIONS") {
            return reply.code(204).send();
        }
    });
    app.setErrorHandler((error, request, reply) => {
        app.log.error({ err: error, path: request.url }, "request failed");
        const statusCode = hasStatusCode(error) && error.statusCode >= 400 ? error.statusCode : 500;
        const code = statusCode >= 500 ? "internal_error" : "request_error";
        const message = error instanceof Error ? error.message : "unknown error";
        return reply.code(statusCode).send(fail(code, message));
    });
    registerDevUiRoutes(app, env, runtime);
    registerMonitorRoutes(app, runtime);
    registerIngestRoutes(app, runtime, digest);
    registerInternalRoutes(app, env, runtime);
    return app;
}
function hasStatusCode(error) {
    if (!error || typeof error !== "object") {
        return false;
    }
    return "statusCode" in error && typeof error.statusCode === "number";
}
function buildFastifyLoggerOptions() {
    const isDev = (process.env.NODE_ENV ?? "development") === "development";
    const usePretty = parseBooleanLike(process.env.LOG_PRETTY, isDev);
    if (!usePretty) {
        return {
            level: process.env.LOG_LEVEL ?? "info"
        };
    }
    return {
        level: process.env.LOG_LEVEL ?? "info",
        transport: {
            target: "pino-pretty",
            options: {
                colorize: true,
                singleLine: true,
                translateTime: "SYS:standard"
            }
        }
    };
}
