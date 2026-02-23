import { fail } from "./http-envelope.js";
export function isBearerAuthorized(header, expectedToken) {
    if (!header) {
        return false;
    }
    const [scheme, token] = header.split(" ");
    if (scheme?.toLowerCase() !== "bearer") {
        return false;
    }
    return token === expectedToken;
}
export async function authenticateDigestPush(request, reply, runtime, digest) {
    const parsed = digest.parseAuthorization(request.headers.authorization);
    if (!parsed) {
        return challenge(reply, digest);
    }
    const principal = runtime.resolvePushAuth(parsed.username);
    if (!principal) {
        runtime.markIngestFailure();
        return challenge(reply, digest);
    }
    const isValid = digest.validate(parsed, request.method, principal.password);
    if (!isValid) {
        runtime.markIngestFailure();
        return challenge(reply, digest);
    }
    return { deviceId: principal.deviceId };
}
function challenge(reply, digest) {
    reply
        .code(401)
        .header("www-authenticate", digest.makeChallengeHeader())
        .send(fail("unauthorized", "digest auth required"));
    return null;
}
