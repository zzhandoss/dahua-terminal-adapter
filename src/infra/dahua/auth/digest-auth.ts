import { request, Agent, type Dispatcher } from "undici";
import { makeCnonce } from "../../../shared/crypto.js";
import { md5Hex } from "../../../shared/hash.js";

type RequestOptions = {
  method: "GET" | "POST";
  url: string;
  body?: string | Buffer;
  headers?: Record<string, string>;
  timeoutMs: number;
  signal?: AbortSignal;
};

type DigestChallenge = {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string;
  stale?: string;
};

export class DigestAuthClient {
  private nonceCounter = 0;
  private challenge: DigestChallenge | null = null;
  private readonly dispatcher?: Dispatcher;

  constructor(
    private readonly username: string,
    private readonly password: string,
    rejectUnauthorized: boolean
  ) {
    this.dispatcher = new Agent({ connect: { rejectUnauthorized } });
  }

  async request(options: RequestOptions) {
    const first = await request(options.url, {
      method: options.method,
      body: options.body,
      headers: options.headers,
      dispatcher: this.dispatcher,
      signal: withTimeout(options.timeoutMs, options.signal)
    });

    if (first.statusCode !== 401) {
      return first;
    }

    const challengeHeader = first.headers["www-authenticate"];
    await first.body.dump();
    const challengeValue = Array.isArray(challengeHeader)
      ? challengeHeader.find((v) => v.toLowerCase().startsWith("digest"))
      : challengeHeader;

    if (!challengeValue) {
      throw new Error("digest challenge missing");
    }

    this.challenge = parseDigestChallenge(challengeValue);
    const authHeader = this.buildAuthHeader(options.method, options.url);

    return request(options.url, {
      method: options.method,
      body: options.body,
      headers: {
        ...(options.headers ?? {}),
        authorization: authHeader
      },
      dispatcher: this.dispatcher,
      signal: withTimeout(options.timeoutMs, options.signal)
    });
  }

  private buildAuthHeader(method: string, urlText: string): string {
    if (!this.challenge) {
      throw new Error("digest challenge not initialized");
    }

    const url = new URL(urlText);
    const uri = `${url.pathname}${url.search}`;
    this.nonceCounter += 1;
    const nc = this.nonceCounter.toString(16).padStart(8, "0");
    const cnonce = makeCnonce();
    const qop = this.challenge.qop?.split(",").map((s) => s.trim()).find((q) => q === "auth") ?? undefined;

    const ha1 = md5Hex(`${this.username}:${this.challenge.realm}:${this.password}`);
    const ha2 = md5Hex(`${method}:${uri}`);
    const response = qop
      ? md5Hex(`${ha1}:${this.challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
      : md5Hex(`${ha1}:${this.challenge.nonce}:${ha2}`);

    const parts = [
      `username=\"${this.username}\"`,
      `realm=\"${this.challenge.realm}\"`,
      `nonce=\"${this.challenge.nonce}\"`,
      `uri=\"${uri}\"`,
      `response=\"${response}\"`
    ];

    if (this.challenge.opaque) {
      parts.push(`opaque=\"${this.challenge.opaque}\"`);
    }

    if (qop) {
      parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce=\"${cnonce}\"`);
    }

    return `Digest ${parts.join(", ")}`;
  }
}

function withTimeout(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) {
    return timeout;
  }
  return AbortSignal.any([timeout, signal]);
}

function parseDigestChallenge(header: string): DigestChallenge {
  const value = header.replace(/^Digest\s+/i, "");
  const pairs = value.match(/(\w+)=("[^"]*"|[^,]+)/g) ?? [];
  const out: Record<string, string> = {};
  for (const pair of pairs) {
    const [k, v] = pair.split("=");
    out[k] = v.replace(/^"|"$/g, "");
  }
  if (!out.realm || !out.nonce) {
    throw new Error("invalid digest challenge");
  }
  return {
    realm: out.realm,
    nonce: out.nonce,
    qop: out.qop,
    opaque: out.opaque,
    algorithm: out.algorithm,
    stale: out.stale
  };
}
