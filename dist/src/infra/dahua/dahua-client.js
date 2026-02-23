import { DigestAuthClient } from "./auth/digest-auth.js";
import { DahuaRpcClient } from "./rpc/rpc-client.js";
import { toIntOrNull, toObjectOrNull } from "../../shared/parse.js";
export class DahuaClient {
    config;
    baseUrl;
    digest;
    rpc;
    rpcSessionReady = false;
    constructor(config) {
        this.config = config;
        this.baseUrl = `${config.protocol}://${config.host}:${config.port}`;
        this.digest = new DigestAuthClient(config.username, config.password, config.rejectUnauthorized);
        this.rpc = new DahuaRpcClient(this.baseUrl, config.username, config.password, config.requestTimeoutMs);
    }
    async connect() {
        return;
    }
    async close() {
        if (!this.rpcSessionReady) {
            return;
        }
        await this.rpc.logout().catch(() => undefined);
        this.rpcSessionReady = false;
    }
    async healthCheck() {
        await this.ensureRpcSession();
        await this.rpc.keepAlive();
    }
    async findAccessUsers(input) {
        return this.runAccessFind({
            path: "/cgi-bin/AccessUser.cgi",
            condition: input.condition,
            limit: input.limit,
            offset: input.offset ?? 0
        });
    }
    async findAccessCards(input) {
        return this.runAccessFind({
            path: "/cgi-bin/AccessCard.cgi",
            condition: input.condition,
            limit: input.limit,
            offset: input.offset ?? 0
        });
    }
    async findAccessControlRecords(input) {
        const response = await this.cgiGet("/cgi-bin/recordFinder.cgi", {
            action: "find",
            name: "AccessControlCardRec",
            StartTime: String(input.startTimeUtcSec),
            EndTime: String(input.endTimeUtcSec),
            count: String(input.count)
        });
        const kv = parseKeyValueLines(response);
        return parseAccessControlRows(kv);
    }
    async runAccessFind(input) {
        const startRaw = await this.cgiGet(input.path, {
            action: "startFind",
            ...toConditionQuery(input.condition)
        });
        const start = parseJsonObject(startRaw, `${input.path} startFind`);
        const token = parseOptionalInt(readObjectNumber(start, "Token"));
        const total = parseOptionalInt(readObjectNumber(start, "Total")) ?? 0;
        const caps = parseOptionalInt(readObjectNumber(start, "Caps")) ?? input.limit;
        if (token === null || total <= 0 || input.limit <= 0) {
            return [];
        }
        const startOffset = Math.max(0, input.offset);
        const maxToFetch = Math.max(0, Math.min(total - startOffset, input.limit));
        const batchSize = Math.max(1, Math.min(caps, maxToFetch));
        const out = [];
        try {
            let offset = startOffset;
            while (offset < startOffset + maxToFetch) {
                const remaining = startOffset + maxToFetch - offset;
                const count = Math.min(batchSize, remaining);
                const findRaw = await this.cgiGet(input.path, {
                    action: "doFind",
                    Token: String(token),
                    Offset: String(offset),
                    Count: String(count)
                });
                const findObj = parseJsonObject(findRaw, `${input.path} doFind`);
                const info = readInfoArray(findObj);
                if (info.length === 0) {
                    break;
                }
                out.push(...info);
                offset += info.length;
                if (info.length < count) {
                    break;
                }
            }
        }
        finally {
            await this.cgiGet(input.path, {
                action: "stopFind",
                Token: String(token)
            }).catch(() => undefined);
        }
        return out.slice(0, input.limit);
    }
    async cgiGet(path, query) {
        const response = await this.digest.request({
            method: "GET",
            url: this.makeCgiUrl(path, query),
            timeoutMs: this.config.requestTimeoutMs
        });
        if (response.statusCode < 200 || response.statusCode > 299) {
            const body = await response.body.text();
            throw new Error(`cgi status ${response.statusCode}: ${body}`);
        }
        return response.body.text();
    }
    makeCgiUrl(path, query) {
        const url = new URL(path, this.baseUrl);
        for (const [k, v] of Object.entries(query)) {
            url.searchParams.append(k, v);
        }
        return url.toString();
    }
    async ensureRpcSession() {
        if (this.rpcSessionReady) {
            return;
        }
        await this.rpc.login();
        this.rpcSessionReady = true;
    }
}
function parseJsonObject(raw, source) {
    try {
        const parsed = JSON.parse(raw);
        const object = toObjectOrNull(parsed);
        if (!object) {
            throw new Error("expected object");
        }
        return object;
    }
    catch (error) {
        throw new Error(`${source} invalid json: ${error.message}`);
    }
}
function readObjectNumber(value, key) {
    const raw = value[key];
    if (raw === undefined || raw === null) {
        return undefined;
    }
    return String(raw);
}
function readInfoArray(value) {
    const raw = value.Info ?? value.info;
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw.filter((item) => typeof item === "object" && item !== null);
}
function toConditionQuery(condition) {
    const out = {};
    for (const [key, value] of Object.entries(condition)) {
        out[`Condition.${key}`] = value;
    }
    return out;
}
function parseKeyValueLines(input) {
    const out = {};
    for (const line of input.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        const idx = trimmed.indexOf("=");
        if (idx < 0) {
            continue;
        }
        out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
    }
    return out;
}
function parseAccessControlRows(kv) {
    const indexes = new Set();
    for (const key of Object.keys(kv)) {
        const match = key.match(/^records\[(\d+)\]\./);
        if (match) {
            indexes.add(Number.parseInt(match[1] ?? "0", 10));
        }
    }
    return [...indexes]
        .sort((a, b) => a - b)
        .map((index) => {
        const prefix = `records[${index}]`;
        const raw = {};
        for (const [key, value] of Object.entries(kv)) {
            if (key.startsWith(`${prefix}.`)) {
                raw[key.slice(prefix.length + 1)] = value;
            }
        }
        const recNo = Number.parseInt(raw.RecNo ?? "", 10);
        return {
            recNo: Number.isNaN(recNo) ? -1 : recNo,
            createTimeUtcSec: parseOptionalInt(raw.CreateTime),
            userId: raw.UserID ?? null,
            cardNo: raw.CardNo ?? null,
            type: raw.Type ?? null,
            method: parseOptionalInt(raw.Method),
            status: parseOptionalInt(raw.Status),
            raw
        };
    })
        .filter((item) => item.recNo >= 0);
}
function parseOptionalInt(value) {
    if (!value) {
        return null;
    }
    return toIntOrNull(value);
}
