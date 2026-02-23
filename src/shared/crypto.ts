import { randomBytes, createHmac } from "node:crypto";

export function signHmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function makeCnonce(): string {
  return randomBytes(16).toString("hex");
}
