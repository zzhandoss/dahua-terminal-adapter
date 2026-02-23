import { createHash, randomBytes } from "node:crypto";

export type DigestAuthHeader = {
  username: string;
  realm: string;
  nonce: string;
  uri: string;
  response: string;
  nc: string;
  cnonce: string;
  qop: string;
};

type NonceEntry = {
  expiresAt: number;
};

export class DigestAuthServer {
  private readonly nonces = new Map<string, NonceEntry>();

  constructor(
    private readonly realm: string,
    private readonly ttlMs: number
  ) {}

  makeChallengeHeader(): string {
    this.gc();
    const nonce = randomBytes(12).toString("hex");
    this.nonces.set(nonce, { expiresAt: Date.now() + this.ttlMs });
    const opaque = createHash("md5").update(`${this.realm}:${nonce}`).digest("hex");
    return `Digest realm="${this.realm}", qop="auth", nonce="${nonce}", opaque="${opaque}"`;
  }

  parseAuthorization(header: string | undefined): DigestAuthHeader | null {
    if (!header) {
      return null;
    }
    if (!header.toLowerCase().startsWith("digest ")) {
      return null;
    }
    const values = parseDigestPairs(header.slice(7));
    const username = values.username;
    const realm = values.realm;
    const nonce = values.nonce;
    const uri = values.uri;
    const response = values.response;
    const nc = values.nc;
    const cnonce = values.cnonce;
    const qop = values.qop;
    if (!username || !realm || !nonce || !uri || !response || !nc || !cnonce || !qop) {
      return null;
    }
    return { username, realm, nonce, uri, response, nc, cnonce, qop };
  }

  validate(header: DigestAuthHeader, method: string, password: string): boolean {
    this.gc();
    if (header.realm !== this.realm || header.qop !== "auth") {
      return false;
    }
    const nonce = this.nonces.get(header.nonce);
    if (!nonce || nonce.expiresAt <= Date.now()) {
      return false;
    }

    const ha1 = md5(`${header.username}:${header.realm}:${password}`);
    const ha2 = md5(`${method.toUpperCase()}:${header.uri}`);
    const expected = md5(`${ha1}:${header.nonce}:${header.nc}:${header.cnonce}:${header.qop}:${ha2}`);
    return header.response.toLowerCase() === expected.toLowerCase();
  }

  private gc(): void {
    const now = Date.now();
    for (const [nonce, item] of this.nonces) {
      if (item.expiresAt <= now) {
        this.nonces.delete(nonce);
      }
    }
  }
}

function parseDigestPairs(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  const regex = /([a-zA-Z0-9]+)=("([^"]*)"|([^,]+))(?:,\s*)?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    const key = match[1] ?? "";
    const quoted = match[3];
    const plain = match[4];
    out[key] = (quoted ?? plain ?? "").trim();
  }
  return out;
}

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}
