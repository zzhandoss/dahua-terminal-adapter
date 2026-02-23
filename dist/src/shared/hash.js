import { createHash } from "node:crypto";
export function md5Hex(value) {
    return createHash("md5").update(value).digest("hex");
}
export function sha1Hex(value) {
    return createHash("sha1").update(value).digest("hex");
}
