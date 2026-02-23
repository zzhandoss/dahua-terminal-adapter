import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { RELEASE_OUT_DIR, readVersion, sha256File, writeText } from "./lib.mjs";

async function main() {
  const version = readVersion();
  const expectedPrefix = `dahua-adapter-v${version}-`;
  const zipFiles = readdirSync(RELEASE_OUT_DIR)
    .filter((name) => name.startsWith(expectedPrefix) && name.endsWith(".zip"))
    .sort();

  if (zipFiles.length === 0) {
    throw new Error(`no zip artifacts found in ${RELEASE_OUT_DIR}`);
  }

  const lines = [];
  for (const fileName of zipFiles) {
    const fullPath = join(RELEASE_OUT_DIR, fileName);
    const digest = await sha256File(fullPath);
    lines.push(`${digest}  ${basename(fullPath)}`);
  }

  const checksumFileName = `dahua-adapter-v${version}-SHA256SUMS.txt`;
  const checksumPath = join(RELEASE_OUT_DIR, checksumFileName);
  writeText(checksumPath, `${lines.join("\n")}\n`);
  process.stdout.write(`${checksumPath}\n`);
}

void main();
