import { join } from "node:path";
import { readJsonFile } from "./backup-utils.js";

export type BackupMode = "nightly" | "pre-update";

export interface BackupSection {
  name: "adapter" | "config" | "license" | "logs";
  sourceRelativePath: string;
  bundleRelativePath: string;
  restoreRelativePath: string;
  optional: boolean;
  included: boolean;
  fileCount: number;
}

export interface BackupManifest {
  schemaVersion: 1;
  restorePointId: string;
  createdAt: string;
  backupMode: BackupMode;
  appVersion: string;
  nodeVersion: string;
  platform: string;
  checksumAlgorithm: "sha256";
  compatibility: {
    policy: "exactVersion";
    appVersion: string;
  };
  logCapture: {
    included: boolean;
    maxFiles: number;
  };
  sections: BackupSection[];
}

export function readManifest(bundleDir: string): BackupManifest {
  return parseManifest(readJsonFile(join(bundleDir, "manifest.json")));
}

function parseManifest(value: unknown): BackupManifest {
  if (!value || typeof value !== "object") {
    throw new Error("invalid backup manifest: expected object");
  }

  const input = value as Record<string, unknown>;
  return {
    schemaVersion: readLiteralOne(input.schemaVersion, "schemaVersion"),
    restorePointId: readString(input.restorePointId, "restorePointId"),
    createdAt: readString(input.createdAt, "createdAt"),
    backupMode: readBackupMode(input.backupMode, "backupMode"),
    appVersion: readString(input.appVersion, "appVersion"),
    nodeVersion: readString(input.nodeVersion, "nodeVersion"),
    platform: readString(input.platform, "platform"),
    checksumAlgorithm: readChecksumAlgorithm(input.checksumAlgorithm, "checksumAlgorithm"),
    compatibility: readCompatibility(input.compatibility),
    logCapture: readLogCapture(input.logCapture),
    sections: readSections(input.sections)
  };
}

function readSections(value: unknown): BackupSection[] {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error("invalid backup manifest: sections");
  }
  return value.map((item, index) => readSection(item, `sections[${index}]`));
}

function readSection(value: unknown, label: string): BackupSection {
  if (!value || typeof value !== "object") {
    throw new Error(`invalid backup manifest: ${label}`);
  }
  const input = value as Record<string, unknown>;
  return {
    name: readSectionName(input.name, `${label}.name`),
    sourceRelativePath: readPathString(input.sourceRelativePath, `${label}.sourceRelativePath`, true),
    bundleRelativePath: readString(input.bundleRelativePath, `${label}.bundleRelativePath`),
    restoreRelativePath: readPathString(input.restoreRelativePath, `${label}.restoreRelativePath`, true),
    optional: readBoolean(input.optional, `${label}.optional`),
    included: readBoolean(input.included, `${label}.included`),
    fileCount: readNonNegativeInteger(input.fileCount, `${label}.fileCount`)
  };
}

function readCompatibility(value: unknown): BackupManifest["compatibility"] {
  if (!value || typeof value !== "object") {
    throw new Error("invalid backup manifest: compatibility");
  }
  const input = value as Record<string, unknown>;
  return {
    policy: readExactPolicy(input.policy, "compatibility.policy"),
    appVersion: readString(input.appVersion, "compatibility.appVersion")
  };
}

function readLogCapture(value: unknown): BackupManifest["logCapture"] {
  if (!value || typeof value !== "object") {
    throw new Error("invalid backup manifest: logCapture");
  }
  const input = value as Record<string, unknown>;
  return {
    included: readBoolean(input.included, "logCapture.included"),
    maxFiles: readNonNegativeInteger(input.maxFiles, "logCapture.maxFiles")
  };
}

function readLiteralOne(value: unknown, label: string): 1 {
  if (value !== 1) {
    throw new Error(`invalid backup manifest: ${label}`);
  }
  return 1;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`invalid backup manifest: ${label}`);
  }
  return value;
}

function readPathString(value: unknown, label: string, allowEmpty: boolean): string {
  if (typeof value !== "string") {
    throw new Error(`invalid backup manifest: ${label}`);
  }
  if (!allowEmpty && value.length === 0) {
    throw new Error(`invalid backup manifest: ${label}`);
  }
  return value;
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`invalid backup manifest: ${label}`);
  }
  return value;
}

function readNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`invalid backup manifest: ${label}`);
  }
  return value;
}

function readBackupMode(value: unknown, label: string): BackupMode {
  if (value === "nightly" || value === "pre-update") {
    return value;
  }
  throw new Error(`invalid backup manifest: ${label}`);
}

function readChecksumAlgorithm(value: unknown, label: string): "sha256" {
  if (value !== "sha256") {
    throw new Error(`invalid backup manifest: ${label}`);
  }
  return "sha256";
}

function readExactPolicy(value: unknown, label: string): "exactVersion" {
  if (value !== "exactVersion") {
    throw new Error(`invalid backup manifest: ${label}`);
  }
  return "exactVersion";
}

function readSectionName(value: unknown, label: string): BackupSection["name"] {
  if (value === "adapter" || value === "config" || value === "license" || value === "logs") {
    return value;
  }
  throw new Error(`invalid backup manifest: ${label}`);
}
