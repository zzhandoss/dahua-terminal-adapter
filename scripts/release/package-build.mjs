import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  RELEASE_OUT_DIR,
  RELEASE_STAGING_DIR,
  ROOT_DIR,
  cleanDir,
  copyPath,
  readVersion,
  writeText,
  zipDirectory
} from "./lib.mjs";

function resolveTarget() {
  if (process.arch !== "x64") {
    throw new Error(`unsupported architecture for current release matrix: ${process.arch}`);
  }
  if (process.platform === "win32") {
    return "win-x64";
  }
  if (process.platform === "linux") {
    return "linux-x64";
  }
  throw new Error(`unsupported platform for release build: ${process.platform}`);
}

function assertRequiredPath(pathLabel, pathValue) {
  if (!existsSync(pathValue)) {
    throw new Error(`${pathLabel} not found: ${pathValue}`);
  }
}

function copyPlatformScripts(target, stagingDir) {
  if (target === "linux-x64") {
    copyPath(join(ROOT_DIR, "scripts", "install", "linux"), join(stagingDir, "scripts", "install", "linux"));
  } else {
    copyPath(join(ROOT_DIR, "scripts", "install", "windows"), join(stagingDir, "scripts", "install", "windows"));
  }
  if (existsSync(join(ROOT_DIR, "ops"))) {
    copyPath(join(ROOT_DIR, "ops"), join(stagingDir, "ops"));
  }
}

function writeBuildMeta(target, stagingDir, version) {
  const info = {
    version,
    target,
    nodeVersion: process.version,
    commit: process.env.GITHUB_SHA ?? "local",
    builtAt: new Date().toISOString()
  };
  writeText(join(stagingDir, "VERSION"), `${version}\n`);
  writeText(join(stagingDir, "BUILD_INFO.json"), `${JSON.stringify(info, null, 2)}\n`);
}

function main() {
  const version = readVersion();
  const target = resolveTarget();
  const stagingDir = join(RELEASE_STAGING_DIR, "build", target);
  const archivePath = join(RELEASE_OUT_DIR, `dahua-adapter-v${version}-${target}.zip`);

  assertRequiredPath("dist", join(ROOT_DIR, "dist"));
  assertRequiredPath("node_modules", join(ROOT_DIR, "node_modules"));
  assertRequiredPath(".env.example", join(ROOT_DIR, ".env.example"));
  assertRequiredPath("package.json", join(ROOT_DIR, "package.json"));
  assertRequiredPath("pnpm-lock.yaml", join(ROOT_DIR, "pnpm-lock.yaml"));

  cleanDir(stagingDir);
  copyPath(join(ROOT_DIR, "dist"), join(stagingDir, "dist"));
  copyPath(join(ROOT_DIR, "node_modules"), join(stagingDir, "node_modules"));
  copyPath(join(ROOT_DIR, ".env.example"), join(stagingDir, ".env.example"));
  copyPath(join(ROOT_DIR, "package.json"), join(stagingDir, "package.json"));
  copyPath(join(ROOT_DIR, "pnpm-lock.yaml"), join(stagingDir, "pnpm-lock.yaml"));
  copyPlatformScripts(target, stagingDir);
  writeBuildMeta(target, stagingDir, version);

  zipDirectory(stagingDir, archivePath);
  process.stdout.write(`${archivePath}\n`);
}

main();
