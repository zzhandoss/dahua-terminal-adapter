import { join } from "node:path";
import {
  RELEASE_OUT_DIR,
  RELEASE_STAGING_DIR,
  cleanDir,
  copyRepoSubset,
  readVersion,
  zipDirectory
} from "./lib.mjs";

const SOURCE_EXCLUDES = [
  ".env",
  ".idea",
  "node_modules",
  "dist",
  "data",
  "release/out",
  "release/staging"
];

function shouldInclude(relativePath) {
  return !SOURCE_EXCLUDES.some((excluded) => {
    return relativePath === excluded || relativePath.startsWith(`${excluded}/`);
  });
}

function main() {
  const version = readVersion();
  const stagingDir = join(RELEASE_STAGING_DIR, "source");
  const archivePath = join(RELEASE_OUT_DIR, `dahua-adapter-v${version}-source.zip`);
  cleanDir(stagingDir);
  copyRepoSubset(stagingDir, shouldInclude);
  zipDirectory(stagingDir, archivePath);
  process.stdout.write(`${archivePath}\n`);
}

main();
