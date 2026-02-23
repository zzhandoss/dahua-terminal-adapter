import { request } from "undici";
import type { Logger } from "pino";
import type {
  AdapterEventsInput,
  AdapterHeartbeatInput,
  AdapterIngestResponse,
  AdapterLease,
  AdapterRegisterInput
} from "../../contracts/device-service.js";
import { signHmacSha256Hex } from "../../shared/crypto.js";
import { parseJsonSafe } from "../../shared/parse.js";

export type DeviceServiceClientOptions = {
  baseUrl: string;
  bearerToken: string;
  hmacSecret: string;
  timeoutMs: number;
  logger?: Logger;
};

type DeviceServiceSuccessEnvelope<T> = {
  success: true;
  data: T;
};

type DeviceServiceErrorEnvelope = {
  success: false;
  error: {
    code?: string;
    message?: string;
    data?: unknown;
  };
};

type DeviceServiceEnvelope<T> = DeviceServiceSuccessEnvelope<T> | DeviceServiceErrorEnvelope;

export class DeviceServiceClient {
  constructor(private readonly options: DeviceServiceClientOptions) {}

  async register(input: AdapterRegisterInput): Promise<AdapterLease> {
    return this.post<AdapterLease>("/adapters/register", input);
  }

  async heartbeat(input: AdapterHeartbeatInput): Promise<AdapterLease> {
    return this.post<AdapterLease>("/adapters/heartbeat", input);
  }

  async ingestEvents(input: AdapterEventsInput): Promise<AdapterIngestResponse> {
    return this.post<AdapterIngestResponse>("/adapters/events", input);
  }

  private async post<T>(path: string, bodyValue: unknown): Promise<T> {
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
    this.options.logger?.info(
      { url, path, statusCode: response.statusCode, responsePayload: parsedPayload ?? rawResponse },
      "ds response"
    );

    if (response.statusCode >= 500) {
      throw new Error(`device-service temporary error: ${response.statusCode}`);
    }

    if (response.statusCode >= 400) {
      const envelope = parsedPayload as DeviceServiceEnvelope<unknown> | null;
      if (envelope && isEnvelope(envelope) && !envelope.success) {
        throw new PermanentDeviceServiceError(
          `device-service permanent error: ${response.statusCode} ${envelope.error.code ?? "unknown_error"} ${envelope.error.message ?? "unknown message"}`,
          {
            statusCode: response.statusCode,
            code: envelope.error.code ?? "unknown_error",
            path,
            data: envelope.error.data
          }
        );
      }
      throw new PermanentDeviceServiceError(`device-service permanent error: ${response.statusCode} ${rawResponse}`, {
        statusCode: response.statusCode,
        code: "http_error",
        path
      });
    }

    const payload = (parsedPayload as DeviceServiceEnvelope<T> | T | null) ?? (rawResponse as T);
    return unwrapEnvelope(path, payload);
  }
}

export class PermanentDeviceServiceError extends Error {
  readonly statusCode?: number;
  readonly code?: string;
  readonly path?: string;
  readonly data?: unknown;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      code?: string;
      path?: string;
      data?: unknown;
    }
  ) {
    super(message);
    this.statusCode = options?.statusCode;
    this.code = options?.code;
    this.path = options?.path;
    this.data = options?.data;
  }
}

function unwrapEnvelope<T>(path: string, payload: DeviceServiceEnvelope<T> | T): T {
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

function isEnvelope<T>(payload: DeviceServiceEnvelope<T> | T): payload is DeviceServiceEnvelope<T> {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  return "success" in payload;
}
