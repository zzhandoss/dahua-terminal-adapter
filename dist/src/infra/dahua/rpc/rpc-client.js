import { request } from "undici";
import { createHash } from "node:crypto";
export class DahuaRpcClient {
    baseUrl;
    username;
    password;
    timeoutMs;
    session = "";
    id = 1;
    constructor(baseUrl, username, password, timeoutMs) {
        this.baseUrl = baseUrl;
        this.username = username;
        this.password = password;
        this.timeoutMs = timeoutMs;
    }
    async login() {
        const first = await this.sendRaw("/RPC2_Login", {
            method: "global.login",
            params: { userName: this.username, password: "", loginType: "Direct", clientType: "Web3.0" }
        });
        this.session = String(first.session ?? "");
        const firstErrorCode = first.error?.code;
        if (firstErrorCode !== 268632079 && firstErrorCode !== 401) {
            throw new Error(`unexpected login step 1 response: ${firstErrorCode ?? "no error"}`);
        }
        const auth = getAuth(this.username, this.password, first.params);
        const loginType = first.params.encryption === "WatchNet" ? "WatchNet" : "Direct";
        const second = await this.sendRaw("/RPC2_Login", {
            method: "global.login",
            params: {
                userName: this.username,
                password: auth,
                clientType: "Web3.0",
                loginType,
                authorityType: first.params.encryption
            }
        });
        if (second.result !== true && second.result !== 1) {
            throw new Error(`rpc login failed: ${JSON.stringify(second.error)}`);
        }
        if (second.session !== undefined) {
            this.session = String(second.session);
        }
    }
    async keepAlive() {
        await this.call("global.keepAlive", { timeout: 300, active: true });
    }
    async call(method, params, object) {
        return this.withSessionRetry(async () => {
            const response = await this.sendRaw("/RPC2", { method, params, object });
            if (response.error) {
                throw new RpcCallError(response.error.code, response.error.message);
            }
            return response.params;
        });
    }
    async callResult(method, params, object) {
        return this.withSessionRetry(async () => {
            const response = await this.sendRaw("/RPC2", { method, params, object });
            if (response.error) {
                throw new RpcCallError(response.error.code, response.error.message);
            }
            return response.result;
        });
    }
    async logout() {
        try {
            await this.call("global.logout");
        }
        catch {
            return;
        }
    }
    async sendRaw(path, req) {
        const payload = {
            method: req.method,
            params: req.params ?? null,
            id: this.id++,
            ...(typeof req.object === "number" ? { object: req.object } : {})
        };
        if (this.session !== "") {
            Object.assign(payload, { session: this.session });
        }
        const response = await request(`${this.baseUrl}${path}`, {
            method: "POST",
            body: JSON.stringify(payload),
            headers: { "content-type": "application/json" },
            signal: AbortSignal.timeout(this.timeoutMs)
        });
        const bodyText = await response.body.text();
        const parsed = tryParseJson(bodyText);
        if (response.statusCode >= 400) {
            const detail = parsed ? JSON.stringify(parsed) : bodyText;
            throw new Error(`rpc http status: ${response.statusCode} ${detail}`);
        }
        if (!parsed) {
            throw new Error("rpc invalid json response");
        }
        return parsed;
    }
    async withSessionRetry(action) {
        try {
            return await action();
        }
        catch (error) {
            if (!isInvalidSessionError(error)) {
                throw toRpcError(error);
            }
            await this.login();
            return action();
        }
    }
}
function getAuth(username, password, params) {
    if (params.encryption === "Basic") {
        return Buffer.from(`${username}:${password}`).toString("base64");
    }
    if (params.encryption === "Default") {
        const inner = md5(`${username}:${params.realm}:${password}`).toUpperCase();
        return md5(`${username}:${params.random}:${inner}`).toUpperCase();
    }
    return password;
}
function md5(value) {
    return createHash("md5").update(value).digest("hex");
}
function tryParseJson(input) {
    if (!input) {
        return null;
    }
    try {
        return JSON.parse(input);
    }
    catch {
        return null;
    }
}
class RpcCallError extends Error {
    code;
    constructor(code, message) {
        super(`rpc error ${code}: ${message}`);
        this.code = code;
    }
}
function isInvalidSessionError(error) {
    if (!(error instanceof RpcCallError)) {
        return false;
    }
    return error.code === 287637505;
}
function toRpcError(error) {
    if (error instanceof Error) {
        return error;
    }
    return new Error(String(error));
}
