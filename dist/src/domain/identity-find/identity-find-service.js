import { parseDahuaSettings } from "../devices/device-settings.js";
import { renderTemplate } from "./query-template.js";
export class IdentityFindError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}
export class IdentityFindService {
    assignments;
    clientFactory;
    logger;
    constructor(assignments, clientFactory, logger) {
        this.assignments = assignments;
        this.clientFactory = clientFactory;
        this.logger = logger;
    }
    async find(input) {
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
        }
        catch (error) {
            if (error instanceof IdentityFindError) {
                throw error;
            }
            this.logger.error({ err: error, deviceId: input.deviceId }, "identity lookup failed");
            throw new IdentityFindError("vendor identity lookup failed", 502);
        }
        finally {
            await context.client.close().catch(() => undefined);
        }
    }
    async exportUsers(input) {
        const assignment = this.assignments.get(input.deviceId);
        if (!assignment) {
            throw new IdentityFindError("device assignment not found", 404);
        }
        const context = this.clientFactory.create(assignment);
        try {
            await context.client.connect();
            const users = await context.client.findAccessUsers({
                condition: {},
                limit: input.limit,
                offset: input.offset
            });
            const out = users.map((record) => toExportUser(record, "accessUser"));
            if (!input.includeCards) {
                return out;
            }
            const cards = await context.client.findAccessCards({
                condition: {},
                limit: input.limit,
                offset: input.offset
            });
            const existing = new Set(out.map((item) => item.terminalPersonId ?? `card:${item.cardNo ?? ""}`));
            for (const card of cards) {
                const next = toExportUser(card, "accessCard");
                const dedupeKey = next.terminalPersonId ?? `card:${next.cardNo ?? ""}`;
                if (existing.has(dedupeKey)) {
                    continue;
                }
                existing.add(dedupeKey);
                out.push(next);
            }
            return out.slice(0, input.limit);
        }
        catch (error) {
            this.logger.error({ err: error, deviceId: input.deviceId }, "identity export failed");
            throw new IdentityFindError("vendor identity export failed", 502);
        }
        finally {
            await context.client.close().catch(() => undefined);
        }
    }
    async findViaAccessIdentity(client, mapping, input) {
        const rendered = renderMappingParams(mapping.paramsTemplate, {
            identityKey: input.identityKey,
            identityValue: input.identityValue
        });
        const selectors = resolveExactSelectors(mapping.paramsTemplate, input.identityValue);
        const out = [];
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
            }
            catch (error) {
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
function renderMappingParams(paramsTemplate, context) {
    const out = {};
    for (const [key, value] of Object.entries(paramsTemplate)) {
        out[key] = renderTemplate(value, context);
    }
    return out;
}
function extractCondition(rendered, source) {
    const out = {};
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
function resolveExactSelectors(paramsTemplate, expectedIdentityValue) {
    const accessUser = [];
    const accessCard = [];
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
function toMatches(records, selectors, source, limit) {
    if (limit <= 0 || selectors.length === 0) {
        return [];
    }
    const out = [];
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
function toExportUser(record, source) {
    return {
        terminalPersonId: readOptionalString(record.UserID),
        displayName: readDisplayName(record),
        userType: readOptionalString(record.UserType),
        cardNo: readOptionalString(record.CardNo),
        source,
        rawPayload: JSON.stringify({ source, record })
    };
}
function isExactRecordMatch(record, selectors) {
    for (const selector of selectors) {
        const current = readOptionalString(record[selector.field]);
        if (current === selector.expected) {
            return true;
        }
    }
    return false;
}
function readOptionalString(value) {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === "string") {
        return value;
    }
    return String(value);
}
function readDisplayName(record) {
    return readOptionalString(record.UserName)
        ?? readOptionalString(record.CardName)
        ?? readOptionalString(record.Name)
        ?? null;
}
function isNotFoundError(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    return error.message.includes("cgi status 404");
}
