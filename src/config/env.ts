import { z } from "zod";
import { parseBooleanStrict } from "../shared/env-parse.js";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  LOG_OUTPUT: z.enum(["auto", "pretty", "console", "file"]).default("auto"),
  LOG_DIR: z.string().default("./data/logs"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(8091),
  BASE_URL: z.string().url(),
  VENDOR_KEY: z.string().default("dahua"),
  ADAPTER_INSTANCE_KEY: z.string().default("dahua"),
  ADAPTER_INSTANCE_NAME: z.string().default("Dahua Adapter"),
  ADAPTER_VERSION: z.string().default("1.0.0"),
  RETENTION_MS: z.coerce.number().int().positive().default(604800000),
  DS_BASE_URL: z.string().url(),
  DS_BEARER_TOKEN: z.string().min(1),
  DS_HMAC_SECRET: z.string().min(1),
  BACKFILL_BEARER_TOKEN: z.string().min(1),
  PUSH_DIGEST_REALM: z.string().default("dahua-adapter"),
  PUSH_DIGEST_NONCE_TTL_MS: z.coerce.number().int().positive().default(300000),
  SQLITE_PATH: z.string().default("./data/dahua-adapter.db"),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(10000),
  DELIVERY_INTERVAL_MS: z.coerce.number().int().positive().default(1500),
  PURGE_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  DEVICE_RECONNECT_DELAY_MS: z.coerce.number().int().positive().default(3000),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  REJECT_UNAUTHORIZED: z.string().optional().default("false"),
  MOCK_ENABLED: z.string().optional().default("false"),
  MOCK_EVENT_BURST_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  MOCK_EVENT_INTRA_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  MOCK_EVENT_BURST_MIN: z.coerce.number().int().positive().default(2),
  MOCK_EVENT_BURST_MAX: z.coerce.number().int().positive().default(3)
});

type ParsedEnv = z.infer<typeof EnvSchema>;

export type AppEnv = Omit<ParsedEnv, "REJECT_UNAUTHORIZED" | "MOCK_ENABLED" | "LOG_OUTPUT" | "LOG_DIR"> & {
  REJECT_UNAUTHORIZED: boolean;
  MOCK_ENABLED: boolean;
  LOG_OUTPUT?: ParsedEnv["LOG_OUTPUT"];
  LOG_DIR?: string;
};

export function loadEnv(): AppEnv {
  const parsed = EnvSchema.parse(process.env);
  const env: AppEnv = {
    ...parsed,
    REJECT_UNAUTHORIZED: parseBooleanStrict(parsed.REJECT_UNAUTHORIZED, false),
    MOCK_ENABLED: parseBooleanStrict(parsed.MOCK_ENABLED, false)
  };
  if (env.MOCK_ENABLED && env.NODE_ENV !== "development") {
    throw new Error("MOCK_ENABLED is allowed only when NODE_ENV=development");
  }
  if (env.MOCK_EVENT_BURST_MAX < env.MOCK_EVENT_BURST_MIN) {
    throw new Error("MOCK_EVENT_BURST_MAX must be >= MOCK_EVENT_BURST_MIN");
  }
  return env;
}
