import { z } from "zod";
import type { DahuaConnectionConfig } from "../../infra/dahua/dahua-client.js";

export const DAHUA_FIND_PERSON_TEMPLATE_KEYS = [
  "accessUser.Condition.UserID",
  "accessUser.Condition.UserName",
  "accessUser.Condition.UserType",
  "accessUser.Condition.UseTime",
  "accessUser.Condition.IsFirstEnter",
  "accessUser.Condition.FirstEnterDoors",
  "accessUser.Condition.UserStatus",
  "accessUser.Condition.Authority",
  "accessUser.Condition.CitizenIDNo",
  "accessUser.Condition.Password",
  "accessUser.Condition.Doors",
  "accessUser.Condition.TimeSections",
  "accessUser.Condition.SpecialDaysSchedule",
  "accessUser.Condition.ValidFrom",
  "accessUser.Condition.ValidTo",
  "accessCard.Condition.UserID",
  "accessCard.Condition.CardNo",
  "accessCard.Condition.CardType",
  "accessCard.Condition.CardName",
  "accessCard.Condition.CardStatus"
] as const;

export const DAHUA_EVENT_CODES = [
  "AccessControl"
] as const;

const allowedTemplateKeys = new Set<string>(DAHUA_FIND_PERSON_TEMPLATE_KEYS);
const IDENTITY_SOURCE_VALUES = ["accessUser", "accessCard"] as const;

const DahuaIdentityQueryMappingSchema = z.object({
  provider: z.literal("dahua.accessControlIdentity"),
  sources: z.array(z.enum(IDENTITY_SOURCE_VALUES)).min(1).default(["accessUser", "accessCard"]),
  paramsTemplate: z.record(z.string(), z.string()).superRefine((template, ctx) => {
    for (const key of Object.keys(template)) {
      if (!allowedTemplateKeys.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `unsupported paramsTemplate key: ${key}`
        });
      }
    }
  })
});

const TimePolicySchema = z.object({
  mode: z.enum(["boundedDevice", "device", "adapter"]).default("boundedDevice"),
  maxDriftMs: z.coerce.number().int().positive().default(60000)
});

const DeviceSettingsSchema = z.object({
  protocol: z.enum(["http", "https"]).default("http"),
  host: z.string().min(1),
  port: z.coerce.number().int().positive().optional(),
  username: z.string().min(1),
  password: z.string().min(1),
  channel: z.coerce.number().int().min(0).default(0),
  eventCodes: z.array(z.enum(DAHUA_EVENT_CODES)).default(["AccessControl"]),
  requestTimeoutMs: z.coerce.number().int().positive().optional(),
  rejectUnauthorized: z.boolean().optional(),
  pushAuth: z.object({
    username: z.string().min(1),
    password: z.string().min(1),
    token: z.string().min(1).optional()
  }),
  mockEnabled: z.boolean().optional(),
  mockIdentityKey: z.enum(DAHUA_FIND_PERSON_TEMPLATE_KEYS).optional().default("accessUser.Condition.CitizenIDNo"),
  recordBackfillEnabled: z.boolean().default(true),
  backfillLookbackHours: z.coerce.number().int().positive().default(24),
  backfillQueryLimit: z.coerce.number().int().positive().max(1000).default(300),
  identityQueryMappings: z.record(z.string(), DahuaIdentityQueryMappingSchema),
  timePolicy: TimePolicySchema.default({
    mode: "boundedDevice",
    maxDriftMs: 60000
  })
});

export type DahuaDeviceSettings = z.infer<typeof DeviceSettingsSchema>;
export type DahuaIdentityQueryMapping = z.infer<typeof DahuaIdentityQueryMappingSchema>;
export type DahuaTimePolicy = z.infer<typeof TimePolicySchema>;

export function parseDahuaSettings(settingsJson: string | null): DahuaDeviceSettings {
  if (!settingsJson) {
    throw new Error("device settingsJson is empty");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(settingsJson);
  } catch (error) {
    throw new Error(`invalid settingsJson: ${(error as Error).message}`);
  }
  return DeviceSettingsSchema.parse(raw);
}

export function toDahuaConnectionConfig(
  settings: DahuaDeviceSettings,
  defaults: { requestTimeoutMs: number; rejectUnauthorized: boolean }
): DahuaConnectionConfig {
  return {
    protocol: settings.protocol,
    host: settings.host,
    port: settings.port ?? (settings.protocol === "https" ? 443 : 80),
    username: settings.username,
    password: settings.password,
    rejectUnauthorized: settings.rejectUnauthorized ?? defaults.rejectUnauthorized,
    requestTimeoutMs: settings.requestTimeoutMs ?? defaults.requestTimeoutMs
  };
}
