import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const THIS_FILE_PATH = fileURLToPath(import.meta.url);

export const ROOT_DIR = resolve(dirname(THIS_FILE_PATH), "..", "..");
export const RELEASE_DIR = join(ROOT_DIR, "release");
export const RELEASE_STAGING_DIR = join(RELEASE_DIR, "staging");
export const RELEASE_OUT_DIR = resolve(process.env.RELEASE_OUT_DIR ?? join(RELEASE_DIR, "out"));

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export function readVersion() {
  const raw = readFileSync(join(ROOT_DIR, "package.json"), "utf8");
  const parsed = JSON.parse(raw);
  if (typeof parsed.version !== "string") {
    throw new Error("package.json version is missing");
  }
  if (!VERSION_PATTERN.test(parsed.version)) {
    throw new Error(`package.json version must match X.Y.Z, got: ${parsed.version}`);
  }
  return parsed.version;
}

export function cleanDir(dirPath) {
  rmSync(dirPath, { recursive: true, force: true });
  mkdirSync(dirPath, { recursive: true });
}

export function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

export function copyPath(input, output) {
  const sourceStat = statSync(input);
  if (sourceStat.isDirectory()) {
    cpSync(input, output, { recursive: true });
    return;
  }
  ensureDir(dirname(output));
  cpSync(input, output);
}

export function walkFiles(dirPath, onFile) {
  for (const item of readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = join(dirPath, item.name);
    if (item.isDirectory()) {
      walkFiles(fullPath, onFile);
      continue;
    }
    onFile(fullPath);
  }
}

export function copyRepoSubset(stagingDir, shouldInclude) {
  ensureDir(stagingDir);
  for (const item of readdirSync(ROOT_DIR, { withFileTypes: true })) {
    const sourcePath = join(ROOT_DIR, item.name);
    const relativePath = relative(ROOT_DIR, sourcePath).split("\\").join("/");
    if (!shouldInclude(relativePath)) {
      continue;
    }
    const targetPath = join(stagingDir, item.name);
    if (item.isDirectory()) {
      copyDirectoryFiltered(sourcePath, targetPath, shouldInclude);
      continue;
    }
    ensureDir(dirname(targetPath));
    cpSync(sourcePath, targetPath);
  }
}

function copyDirectoryFiltered(sourceDir, targetDir, shouldInclude) {
  ensureDir(targetDir);
  for (const item of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, item.name);
    const relativePath = relative(ROOT_DIR, sourcePath).split("\\").join("/");
    if (!shouldInclude(relativePath)) {
      continue;
    }
    const outputPath = join(targetDir, item.name);
    if (item.isDirectory()) {
      copyDirectoryFiltered(sourcePath, outputPath, shouldInclude);
      continue;
    }
    ensureDir(dirname(outputPath));
    cpSync(sourcePath, outputPath);
  }
}

export function zipDirectory(inputDir, outputZipPath) {
  ensureDir(dirname(outputZipPath));
  if (existsSync(outputZipPath)) {
    rmSync(outputZipPath, { force: true });
  }
  if (process.platform === "win32") {
    const result = spawnSync(
      "tar",
      ["-a", "-c", "-f", outputZipPath, "-C", inputDir, "."],
      {
        stdio: "inherit"
      }
    );
    if (result.status !== 0) {
      throw new Error("tar zip packaging failed");
    }
    return;
  }
  const result = spawnSync("zip", ["-r", "-q", outputZipPath, "."], {
    cwd: inputDir,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error("zip command failed. Ensure zip is installed on this runner");
  }
}

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  await new Promise((resolvePromise, rejectPromise) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", resolvePromise);
    stream.on("error", rejectPromise);
  });
  return hash.digest("hex");
}

export function writeText(filePath, content) {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, "utf8");
}
