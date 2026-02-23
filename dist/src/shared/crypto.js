import { randomBytes, createHmac } from "node:crypto";
export function signHmacSha256Hex(secret, payload) {
    return createHmac("sha256", secret).update(payload).digest("hex");
}
export function makeCnonce() {
    return randomBytes(16).toString("hex");
}
