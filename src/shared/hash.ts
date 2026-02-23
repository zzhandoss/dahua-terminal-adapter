import { createHash } from "node:crypto";

export function md5Hex(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

export function sha1Hex(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}
