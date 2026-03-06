import type { Logger } from "pino";
import type {
  AdapterAssignment,
  IdentityFindMatch,
  IdentityFindRequest
} from "../../contracts/device-service.js";
import { DahuaClientFactory } from "../../app/dahua-client-factory.js";
import {
  parseDahuaSettings,
  type DahuaIdentityQueryMapping
} from "../devices/device-settings.js";
import { renderTemplate } from "./query-template.js";

export class IdentityFindError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
  }
}

export type AssignmentProvider = {
  get(deviceId: string): AdapterAssignment | null;
};

export class IdentityFindService {
  constructor(
    private readonly assignments: AssignmentProvider,
    private readonly clientFactory: DahuaClientFactory,
    private readonly logger: Logger
  ) {}

  async find(input: IdentityFindRequest): Promise<IdentityFindMatch[]> {
    const assignment = this.assignments.get(input.deviceId);
    if (!assignment) {
      throw new IdentityFindError("device assignment not found", 404);
    }

    const settings = parseDahuaSettings(assignment.settingsJson);
    const mapping = settings.identityQueryMappings[input.identityKey];
    if (!mapping) {
      throw new IdentityFindError(`identity key '${input.identityKey}' is not configured`, 422);
    }

    const context = this.clientFactory.create(assignment);
    try {
      await context.client.connect();
      if (mapping.provider === "dahua.accessControlIdentity") {
        return await this.findViaAccessIdentity(context.client, mapping, input);
      }
      throw new IdentityFindError("unsupported provider", 422);
    } catch (error) {
      if (error instanceof IdentityFindError) {
        throw error;
      }
      this.logger.error({ err: error, deviceId: input.deviceId }, "identity lookup failed");
      throw new IdentityFindError("vendor identity lookup failed", 502);
    } finally {
      await context.client.close().catch(() => undefined);
    }
  }

  private async findViaAccessIdentity(
    client: ReturnType<DahuaClientFactory["create"]>["client"],
    mapping: DahuaIdentityQueryMapping,
    input: IdentityFindRequest
  ): Promise<IdentityFindMatch[]> {
    const rendered = renderMappingParams(mapping.paramsTemplate, {
      identityKey: input.identityKey,
      identityValue: input.identityValue
    });

    const selectors = resolveExactSelectors(mapping.paramsTemplate, input.identityValue);
    const out: IdentityFindMatch[] = [];

    for (const source of mapping.sources) {
      if (out.length >= input.limit) {
        break;
      }
      const condition = extractCondition(rendered, source);
      if (Object.keys(condition).length === 0) {
        continue;
      }
      try {
        if (source === "accessUser") {
          const found = await client.findAccessUsers({
            condition,
            limit: input.limit
          });
          out.push(...toMatches(found, selectors.accessUser, "accessUser", input.limit - out.length));
          continue;
        }
        const found = await client.findAccessCards({
          condition,
          limit: input.limit
        });
        out.push(...toMatches(found, selectors.accessCard, "accessCard", input.limit - out.length));
      } catch (error) {
        if (isNotFoundError(error)) {
          this.logger.warn({ err: error, source }, "identity source unavailable, continuing pipeline");
          continue;
        }
        throw error;
      }
    }

    return out.slice(0, input.limit);
  }
}

function renderMappingParams(
  paramsTemplate: Record<string, string>,
  context: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(paramsTemplate)) {
    out[key] = renderTemplate(value, context);
  }
  return out;
}

function extractCondition(
  rendered: Record<string, string>,
  source: "accessUser" | "accessCard"
): Record<string, string> {
  const out: Record<string, string> = {};
  const prefix = `${source}.Condition.`;
  for (const [key, value] of Object.entries(rendered)) {
    if (!key.startsWith(prefix)) {
      continue;
    }
    const field = key.slice(prefix.length);
    if (!field || value === "") {
      continue;
    }
    out[field] = value;
  }
  return out;
}

function resolveExactSelectors(
  paramsTemplate: Record<string, string>,
  expectedIdentityValue: string
): {
  accessUser: Array<{ field: string; expected: string }>;
  accessCard: Array<{ field: string; expected: string }>;
} {
  const accessUser: Array<{ field: string; expected: string }> = [];
  const accessCard: Array<{ field: string; expected: string }> = [];
  for (const [key, value] of Object.entries(paramsTemplate)) {
    if (!value.includes("{{identityValue}}")) {
      continue;
    }
    if (key.startsWith("accessUser.Condition.")) {
      accessUser.push({ field: key.slice("accessUser.Condition.".length), expected: expectedIdentityValue });
    }
    if (key.startsWith("accessCard.Condition.")) {
      accessCard.push({ field: key.slice("accessCard.Condition.".length), expected: expectedIdentityValue });
    }
  }
  return { accessUser, accessCard };
}

function toMatches(
  records: Record<string, unknown>[],
  selectors: Array<{ field: string; expected: string }>,
  source: "accessUser" | "accessCard",
  limit: number
): IdentityFindMatch[] {
  if (limit <= 0 || selectors.length === 0) {
    return [];
  }
  const out: IdentityFindMatch[] = [];
  for (const record of records) {
    if (!isExactRecordMatch(record, selectors)) {
      continue;
    }
    out.push({
      terminalPersonId: readOptionalString(record.UserID),
      score: null,
      rawPayload: JSON.stringify({ source, record }),
      source,
      displayName: readDisplayName(record),
      userType: readOptionalString(record.UserType)
    });
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

function isExactRecordMatch(
  record: Record<string, unknown>,
  selectors: Array<{ field: string; expected: string }>
): boolean {
  for (const selector of selectors) {
    const current = readOptionalString(record[selector.field]);
    if (current === selector.expected) {
      return true;
    }
  }
  return false;
}

function readOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value);
}

function readDisplayName(record: Record<string, unknown>): string | null {
  return readOptionalString(record.UserName)
    ?? readOptionalString(record.CardName)
    ?? readOptionalString(record.Name)
    ?? null;
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.includes("cgi status 404");
}
