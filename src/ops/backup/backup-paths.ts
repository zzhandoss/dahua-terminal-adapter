import { existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { ensureInsideRoot, relativeToRoot, resolvePath } from "./backup-utils.js";

const DEFAULT_SQLITE_PATH = "./data/dahua-adapter.db";
const DEFAULT_LOG_DIR = "./data/logs";
const DEFAULT_BACKUPS_DIR = "./backups";

export interface RuntimePaths {
  rootDir: string;
  envFile: string;
  dataDir: string;
  dataRelativePath: string;
  logDir: string;
  logRelativePath: string;
  backupsDir: string;
  licenseDir: string | null;
  licenseRelativePath: string | null;
}

export interface ResolveRuntimePathsInput {
  rootDir?: string;
  backupsDir?: string;
  licenseDir?: string;
}

export function resolveRuntimePaths(input: ResolveRuntimePathsInput): RuntimePaths {
  const rootDir = resolvePath(process.cwd(), input.rootDir ?? ".");
  const envFile = resolvePath(rootDir, ".env");
  const envRecord = readEnvRecord(envFile);
  const sqlitePath = envRecord.SQLITE_PATH ?? DEFAULT_SQLITE_PATH;
  const dataDir = dirname(ensureInsideRoot(rootDir, sqlitePath, "SQLITE_PATH"));
  const logDir = ensureInsideRoot(rootDir, envRecord.LOG_DIR ?? DEFAULT_LOG_DIR, "LOG_DIR");
  const backupsDir = resolvePath(rootDir, input.backupsDir ?? DEFAULT_BACKUPS_DIR);
  const licenseDir = input.licenseDir ? ensureInsideRoot(rootDir, input.licenseDir, "license dir") : null;

  return {
    rootDir,
    envFile,
    dataDir,
    dataRelativePath: relativeToRoot(rootDir, dataDir),
    logDir,
    logRelativePath: relativeToRoot(rootDir, logDir),
    backupsDir,
    licenseDir,
    licenseRelativePath: licenseDir ? relativeToRoot(rootDir, licenseDir) : null
  };
}

function readEnvRecord(envFile: string): Record<string, string> {
  if (!existsSync(envFile)) {
    return {};
  }
  return parseEnvFile(readFileSync(envFile, "utf8"));
}

function parseEnvFile(content: string): Record<string, string> {
  const output: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    output[key] = stripWrappingQuotes(rawValue);
  }
  return output;
}

function stripWrappingQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}
