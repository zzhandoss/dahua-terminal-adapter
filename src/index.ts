import "dotenv/config";
import { resolve } from "node:path";
import { loadEnv } from "./config/env.js";
import { logger } from "./shared/logger.js";
import { SqliteStore } from "./infra/store/sqlite-store.js";
import { DeviceServiceClient } from "./infra/ds/device-service-client.js";
import { EventStrategyRegistry } from "./domain/events/event-strategy-registry.js";
import { EventNormalizationPipeline } from "./domain/events/event-normalization-pipeline.js";
import { AccessControlStrategy } from "./domain/events/strategies/access-control-strategy.js";
import { AdapterRuntime } from "./app/adapter-runtime.js";
import { buildServer } from "./http/server.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const host = "0.0.0.0";
  const dbPath = resolve(env.SQLITE_PATH);
  const store = new SqliteStore(dbPath);
  const dsClient = new DeviceServiceClient({
    baseUrl: env.DS_BASE_URL,
    bearerToken: env.DS_BEARER_TOKEN,
    hmacSecret: env.DS_HMAC_SECRET,
    timeoutMs: env.HTTP_TIMEOUT_MS,
    logger
  });
  const registry = new EventStrategyRegistry([new AccessControlStrategy()]);
  const pipeline = new EventNormalizationPipeline(registry);
  const runtime = new AdapterRuntime(env, dsClient, store, pipeline, logger);
  const server = buildServer(env, runtime);

  await server.listen({ host, port: env.PORT });
  logger.info({ host, port: env.PORT }, "dahua adapter server started");

  try {
    await runtime.start();
  } catch (error) {
    await server.close();
    store.close();
    throw error;
  }

  const shutdown = async () => {
    await runtime.stop();
    await server.close();
    store.close();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
}

void main().catch((error) => {
  logger.error({ err: error }, "fatal startup error");
  process.exit(1);
});
