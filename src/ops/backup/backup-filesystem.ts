import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { createReadStream } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

export function ensureFileParent(filePath: string): void {
  ensureDir(dirname(filePath));
}

export function writeJson(filePath: string, value: unknown): void {
  ensureFileParent(filePath);
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function removePath(pathValue: string): void {
  rmSync(pathValue, { recursive: true, force: true });
}

export function directoryExists(pathValue: string): boolean {
  return existsSync(pathValue) && statSync(pathValue).isDirectory();
}

export function fileExists(pathValue: string): boolean {
  return existsSync(pathValue) && statSync(pathValue).isFile();
}

export function copyDirectoryContents(
  sourceDir: string,
  targetDir: string,
  options?: { excludePaths?: string[] }
): number {
  ensureDir(targetDir);
  const excluded = new Set((options?.excludePaths ?? []).map((item) => resolve(item)));
  let fileCount = 0;
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    if (excluded.has(resolve(sourcePath))) {
      continue;
    }
    const targetPath = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      fileCount += copyDirectoryContents(sourcePath, targetPath, options);
      continue;
    }
    ensureFileParent(targetPath);
    copyFileSync(sourcePath, targetPath);
    fileCount += 1;
  }
  return fileCount;
}

export function copyFilesIntoDirectory(sourceFiles: string[], sourceRoot: string, targetDir: string): number {
  ensureDir(targetDir);
  let fileCount = 0;
  for (const sourceFile of sourceFiles) {
    const relativePath = relative(sourceRoot, sourceFile);
    const targetFile = join(targetDir, relativePath);
    ensureFileParent(targetFile);
    copyFileSync(sourceFile, targetFile);
    fileCount += 1;
  }
  return fileCount;
}

export function listFilesRecursive(dirPath: string): string[] {
  const output: string[] = [];
  if (!directoryExists(dirPath)) {
    return output;
  }
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      output.push(...listFilesRecursive(fullPath));
      continue;
    }
    output.push(fullPath);
  }
  return output.sort((left, right) => left.localeCompare(right));
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

export function toBundleRelativePath(bundleDir: string, filePath: string): string {
  return relative(bundleDir, filePath).split("\\").join("/");
}

export function isSubPath(childPath: string, parentPath: string): boolean {
  const relativePath = relative(parentPath, childPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

export function pathExists(pathValue: string): boolean {
  try {
    lstatSync(pathValue);
    return true;
  } catch {
    return false;
  }
}
