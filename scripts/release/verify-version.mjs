import { readFileSync } from "node:fs";

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

function readPackageVersion() {
  const raw = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
  const parsed = JSON.parse(raw);
  if (typeof parsed.version !== "string") {
    throw new Error("package.json version is missing");
  }
  if (!VERSION_PATTERN.test(parsed.version)) {
    throw new Error(`package.json version must match X.Y.Z, got: ${parsed.version}`);
  }
  return parsed.version;
}

function readReleaseTag() {
  const tagArg = process.argv[2];
  const tagEnv = process.env.GITHUB_REF_NAME;
  const tag = (tagArg ?? tagEnv ?? "").trim();
  if (!tag) {
    throw new Error("release tag not provided. Pass as argv[2] or set GITHUB_REF_NAME");
  }
  return tag;
}

function main() {
  const version = readPackageVersion();
  const tag = readReleaseTag();
  const expected = `v${version}`;
  if (tag !== expected) {
    throw new Error(`release tag mismatch: expected ${expected}, got ${tag}`);
  }
  process.stdout.write(`${version}\n`);
}

main();
