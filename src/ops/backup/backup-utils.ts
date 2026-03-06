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
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

export function pathExists(pathValue: string): boolean {
  return existsSync(pathValue);
}

export function copyPath(sourcePath: string, targetPath: string): void {
  const sourceStat = statSync(sourcePath);
  ensureDir(dirname(targetPath));
  if (sourceStat.isDirectory()) {
    cpSync(sourcePath, targetPath, { recursive: true });
    return;
  }
  cpSync(sourcePath, targetPath);
}

export function replacePath(sourcePath: string, targetPath: string): void {
  rmSync(targetPath, { recursive: true, force: true });
  copyPath(sourcePath, targetPath);
}

export function copyDirectoryFiltered(
  sourceDir: string,
  targetDir: string,
  shouldInclude: (sourcePath: string) => boolean
): void {
  ensureDir(targetDir);
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    if (!shouldInclude(sourcePath)) {
      continue;
    }
    const targetPath = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryFiltered(sourcePath, targetPath, shouldInclude);
      continue;
    }
    ensureDir(dirname(targetPath));
    cpSync(sourcePath, targetPath);
  }
}

export function copySelectedFiles(sourceDir: string, targetDir: string, relativePaths: string[]): void {
  ensureDir(targetDir);
  for (const relativePath of relativePaths) {
    const sourcePath = join(sourceDir, relativePath);
    const targetPath = join(targetDir, relativePath);
    ensureDir(dirname(targetPath));
    cpSync(sourcePath, targetPath);
  }
}

export function walkFiles(dirPath: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

export function countFiles(pathValue: string): number {
  const sourceStat = statSync(pathValue);
  return sourceStat.isDirectory() ? walkFiles(pathValue).length : 1;
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolvePromise());
    stream.on("error", rejectPromise);
  });
  return hash.digest("hex");
}

export function writeJsonFile(filePath: string, value: unknown): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function readPackageVersion(rootDir: string): string {
  const packageJson = readJsonFile<{ version?: string }>(join(rootDir, "package.json"));
  if (!packageJson.version) {
    throw new Error(`package.json version is missing in ${rootDir}`);
  }
  return packageJson.version;
}

export function createStamp(date = new Date()): string {
  return date.toISOString().replace(/[:-]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function toPosixPath(pathValue: string): string {
  return pathValue.split("\\").join("/");
}

export function resolvePath(rootDir: string, pathValue: string): string {
  return isAbsolute(pathValue) ? resolve(pathValue) : resolve(rootDir, pathValue);
}

export function ensureInsideRoot(rootDir: string, pathValue: string, label: string): string {
  const resolvedPath = resolvePath(rootDir, pathValue);
  if (!isSubPath(rootDir, resolvedPath)) {
    throw new Error(`${label} must stay inside ${rootDir}, got ${resolvedPath}`);
  }
  return resolvedPath;
}

export function isSubPath(parentPath: string, childPath: string): boolean {
  const relativePath = relative(parentPath, childPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

export function relativeToRoot(rootDir: string, pathValue: string): string {
  return toPosixPath(relative(rootDir, pathValue));
}
