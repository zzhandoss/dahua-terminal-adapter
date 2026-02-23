import { request } from "undici";
import { signHmacSha256Hex } from "../../shared/crypto.js";
import { parseJsonSafe } from "../../shared/parse.js";
export class DeviceServiceClient {
    options;
    constructor(options) {
        this.options = options;
    }
    async register(input) {
        return this.post("/adapters/register", input);
    }
    async heartbeat(input) {
        return this.post("/adapters/heartbeat", input);
    }
    async ingestEvents(input) {
        return this.post("/adapters/events", input);
    }
    async post(path, bodyValue) {
        const body = JSON.stringify(bodyValue);
        const timestamp = Date.now().toString();
        const signature = signHmacSha256Hex(this.options.hmacSecret, `${timestamp}.${body}`);
        const url = `${this.options.baseUrl}${path}`;
        this.options.logger?.info({ url, path, requestBody: bodyValue }, "ds request");
        const response = await request(url, {
            method: "POST",
            body,
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${this.options.bearerToken}`,
                "x-timestamp": timestamp,
                "x-signature": signature
            },
            signal: AbortSignal.timeout(this.options.timeoutMs)
        });
        const rawResponse = await response.body.text();
        const parsedPayload = parseJsonSafe(rawResponse);
        this.options.logger?.info({ url, path, statusCode: response.statusCode, responsePayload: parsedPayload ?? rawResponse }, "ds response");
        if (response.statusCode >= 500) {
            throw new Error(`device-service temporary error: ${response.statusCode}`);
        }
        if (response.statusCode >= 400) {
            const envelope = parsedPayload;
            if (envelope && isEnvelope(envelope) && !envelope.success) {
                throw new PermanentDeviceServiceError(`device-service permanent error: ${response.statusCode} ${envelope.error.code ?? "unknown_error"} ${envelope.error.message ?? "unknown message"}`, {
                    statusCode: response.statusCode,
                    code: envelope.error.code ?? "unknown_error",
                    path,
                    data: envelope.error.data
                });
            }
            throw new PermanentDeviceServiceError(`device-service permanent error: ${response.statusCode} ${rawResponse}`, {
                statusCode: response.statusCode,
                code: "http_error",
                path
            });
        }
        const payload = parsedPayload ?? rawResponse;
        return unwrapEnvelope(path, payload);
    }
}
export class PermanentDeviceServiceError extends Error {
    statusCode;
    code;
    path;
    data;
    constructor(message, options) {
        super(message);
        this.statusCode = options?.statusCode;
        this.code = options?.code;
        this.path = options?.path;
        this.data = options?.data;
    }
}
function unwrapEnvelope(path, payload) {
    if (!isEnvelope(payload)) {
        return payload;
    }
    if (payload.success) {
        return payload.data;
    }
    const code = payload.error.code ?? "unknown_error";
    const message = payload.error.message ?? "unknown message";
    const detail = payload.error.data === undefined ? "" : ` data=${JSON.stringify(payload.error.data)}`;
    throw new PermanentDeviceServiceError(`device-service error at ${path}: ${code} ${message}${detail}`, {
        statusCode: 200,
        code,
        path,
        data: payload.error.data
    });
}
function isEnvelope(payload) {
    if (!payload || typeof payload !== "object") {
        return false;
    }
    return "success" in payload;
}
