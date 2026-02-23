import { createHash } from "node:crypto";
export function makeDigestChallengeHeader(challenge) {
    return `Digest realm="${challenge.realm}", nonce="${challenge.nonce}", qop="${challenge.qop}", opaque="${challenge.opaque}"`;
}
export function parseDigestAuthorization(header) {
    if (!header.toLowerCase().startsWith("digest ")) {
        return null;
    }
    const tokens = header.slice(7).match(/(\w+)=("[^"]*"|[^,]+)/g) ?? [];
    const map = {};
    for (const token of tokens) {
        const separator = token.indexOf("=");
        if (separator < 0) {
            continue;
        }
        const key = token.slice(0, separator);
        const value = token.slice(separator + 1);
        map[key] = value.replace(/^"|"$/g, "");
    }
    if (!map.username || !map.realm || !map.nonce || !map.uri || !map.response) {
        return null;
    }
    return {
        username: map.username,
        realm: map.realm,
        nonce: map.nonce,
        uri: map.uri,
        response: map.response,
        qop: map.qop,
        nc: map.nc,
        cnonce: map.cnonce,
        opaque: map.opaque
    };
}
export function validateDigestAuth(params) {
    const { method, username, password, challenge, auth } = params;
    if (auth.username !== username || auth.realm !== challenge.realm || auth.nonce !== challenge.nonce) {
        return false;
    }
    const ha1 = md5Hex(`${username}:${challenge.realm}:${password}`);
    const ha2 = md5Hex(`${method}:${auth.uri}`);
    let expected;
    if (auth.qop === "auth" && auth.nc && auth.cnonce) {
        expected = md5Hex(`${ha1}:${challenge.nonce}:${auth.nc}:${auth.cnonce}:auth:${ha2}`);
    }
    else {
        expected = md5Hex(`${ha1}:${challenge.nonce}:${ha2}`);
    }
    return expected === auth.response;
}
function md5Hex(value) {
    return createHash("md5").update(value).digest("hex");
}
