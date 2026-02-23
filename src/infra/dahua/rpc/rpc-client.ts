import { request } from "undici";
import { createHash } from "node:crypto";

export type RpcRequest = {
  method: string;
  params?: unknown;
  object?: number;
};

export class DahuaRpcClient {
  private session = "";
  private id = 1;

  constructor(
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly password: string,
    private readonly timeoutMs: number
  ) {}

  async login(): Promise<void> {
    const first = await this.sendRaw<{ random: string; realm: string; encryption: string }>(
      "/RPC2_Login",
      {
        method: "global.login",
        params: { userName: this.username, password: "", loginType: "Direct", clientType: "Web3.0" }
      }
    );

    this.session = String(first.session ?? "");
    const firstErrorCode = first.error?.code;
    if (firstErrorCode !== 268632079 && firstErrorCode !== 401) {
      throw new Error(`unexpected login step 1 response: ${firstErrorCode ?? "no error"}`);
    }

    const auth = getAuth(this.username, this.password, first.params);
    const loginType = first.params.encryption === "WatchNet" ? "WatchNet" : "Direct";

    const second = await this.sendRaw<unknown>("/RPC2_Login", {
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

  async keepAlive(): Promise<void> {
    await this.call("global.keepAlive", { timeout: 300, active: true });
  }

  async call<T>(method: string, params?: unknown, object?: number): Promise<T> {
    return this.withSessionRetry(async () => {
      const response = await this.sendRaw<T>("/RPC2", { method, params, object });
      if (response.error) {
        throw new RpcCallError(response.error.code, response.error.message);
      }
      return response.params;
    });
  }

  async callResult(method: string, params?: unknown, object?: number): Promise<number | boolean> {
    return this.withSessionRetry(async () => {
      const response = await this.sendRaw<unknown>("/RPC2", { method, params, object });
      if (response.error) {
        throw new RpcCallError(response.error.code, response.error.message);
      }
      return response.result;
    });
  }

  async logout(): Promise<void> {
    try {
      await this.call("global.logout");
    } catch {
      return;
    }
  }

  private async sendRaw<T>(path: string, req: RpcRequest): Promise<RpcResponse<T>> {
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
    const parsed = tryParseJson<RpcResponse<T>>(bodyText);

    if (response.statusCode >= 400) {
      const detail = parsed ? JSON.stringify(parsed) : bodyText;
      throw new Error(`rpc http status: ${response.statusCode} ${detail}`);
    }

    if (!parsed) {
      throw new Error("rpc invalid json response");
    }
    return parsed;
  }

  private async withSessionRetry<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (!isInvalidSessionError(error)) {
        throw toRpcError(error);
      }
      await this.login();
      return action();
    }
  }
}

type RpcResponse<T> = {
  id: number;
  session?: string | number;
  result: boolean | number;
  params: T;
  error?: { code: number; message: string };
};

function getAuth(
  username: string,
  password: string,
  params: { encryption: string; random: string; realm: string }
): string {
  if (params.encryption === "Basic") {
    return Buffer.from(`${username}:${password}`).toString("base64");
  }

  if (params.encryption === "Default") {
    const inner = md5(`${username}:${params.realm}:${password}`).toUpperCase();
    return md5(`${username}:${params.random}:${inner}`).toUpperCase();
  }

  return password;
}

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function tryParseJson<T>(input: string): T | null {
  if (!input) {
    return null;
  }
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

class RpcCallError extends Error {
  constructor(readonly code: number, message: string) {
    super(`rpc error ${code}: ${message}`);
  }
}

function isInvalidSessionError(error: unknown): boolean {
  if (!(error instanceof RpcCallError)) {
    return false;
  }
  return error.code === 287637505;
}

function toRpcError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}
