import type { FastifyReply, FastifyRequest } from "fastify";
import type { AdapterRuntime } from "../app/adapter-runtime.js";
import { DigestAuthServer } from "./digest-auth-server.js";
import { fail } from "./http-envelope.js";

export function isBearerAuthorized(header: string | undefined, expectedToken: string): boolean {
  if (!header) {
    return false;
  }
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer") {
    return false;
  }
  return token === expectedToken;
}

export async function authenticateDigestPush(
  request: FastifyRequest,
  reply: FastifyReply,
  runtime: AdapterRuntime,
  digest: DigestAuthServer
): Promise<{ deviceId: string } | null> {
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

function challenge(reply: FastifyReply, digest: DigestAuthServer): null {
  reply
    .code(401)
    .header("www-authenticate", digest.makeChallengeHeader())
    .send(fail("unauthorized", "digest auth required"));
  return null;
}

