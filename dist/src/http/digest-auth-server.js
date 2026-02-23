import { createHash, randomBytes } from "node:crypto";
export class DigestAuthServer {
    realm;
    ttlMs;
    nonces = new Map();
    constructor(realm, ttlMs) {
        this.realm = realm;
        this.ttlMs = ttlMs;
    }
    makeChallengeHeader() {
        this.gc();
        const nonce = randomBytes(12).toString("hex");
        this.nonces.set(nonce, { expiresAt: Date.now() + this.ttlMs });
        const opaque = createHash("md5").update(`${this.realm}:${nonce}`).digest("hex");
        return `Digest realm="${this.realm}", qop="auth", nonce="${nonce}", opaque="${opaque}"`;
    }
    parseAuthorization(header) {
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
    validate(header, method, password) {
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
    gc() {
        const now = Date.now();
        for (const [nonce, item] of this.nonces) {
            if (item.expiresAt <= now) {
                this.nonces.delete(nonce);
            }
        }
    }
}
function parseDigestPairs(input) {
    const out = {};
    const regex = /([a-zA-Z0-9]+)=("([^"]*)"|([^,]+))(?:,\s*)?/g;
    let match;
    while ((match = regex.exec(input)) !== null) {
        const key = match[1] ?? "";
        const quoted = match[3];
        const plain = match[4];
        out[key] = (quoted ?? plain ?? "").trim();
    }
    return out;
}
function md5(value) {
    return createHash("md5").update(value).digest("hex");
}
