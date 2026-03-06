import { existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { BackupManifest, BackupMode, BackupSection } from "./backup-manifest.js";
import { resolveRuntimePaths } from "./backup-paths.js";
import { writeChecksums } from "./backup-checksums.js";
import {
  copyDirectoryFiltered,
  copyPath,
  copySelectedFiles,
  countFiles,
  createStamp,
  ensureDir,
  isSubPath,
  pathExists,
  readPackageVersion,
  writeJsonFile,
  walkFiles
} from "./backup-utils.js";

export interface CreateBackupOptions {
  rootDir?: string;
  backupsDir?: string;
  licenseDir?: string;
  includeLogs?: boolean;
  maxLogFiles?: number;
  mode: BackupMode;
  now?: Date;
  restorePointId?: string;
}

export interface CreateBackupResult {
  bundleDir: string;
  manifest: BackupManifest;
}

export async function createBackup(options: CreateBackupOptions): Promise<CreateBackupResult> {
  const paths = resolveRuntimePaths(options);
  if (!pathExists(paths.envFile)) {
    throw new Error(`missing .env in ${paths.rootDir}`);
  }
  if (!pathExists(paths.dataDir)) {
    throw new Error(`missing data directory in ${paths.dataDir}`);
  }

  const createdAt = (options.now ?? new Date()).toISOString();
  const restorePointId = options.restorePointId ?? `${createStamp(options.now)}-${options.mode}`;
  const bundleDir = join(paths.backupsDir, restorePointId);
  ensureDir(bundleDir);

  const sections: BackupSection[] = [];
  sections.push(copyAdapterSection(bundleDir, paths.dataDir, paths.dataRelativePath, paths.logDir));
  sections.push(copyConfigSection(bundleDir, paths.envFile));
  sections.push(copyLicenseSection(bundleDir, paths.licenseDir, paths.licenseRelativePath));

  const maxLogFiles = options.maxLogFiles ?? 5;
  sections.push(copyLogSection(bundleDir, paths.logDir, paths.logRelativePath, options.includeLogs ?? false, maxLogFiles));

  const appVersion = readPackageVersion(paths.rootDir);
  const manifest: BackupManifest = {
    schemaVersion: 1,
    restorePointId,
    createdAt,
    backupMode: options.mode,
    appVersion,
    nodeVersion: process.version,
    platform: process.platform,
    checksumAlgorithm: "sha256",
    compatibility: {
      policy: "exactVersion",
      appVersion
    },
    logCapture: {
      included: sections.some((section) => section.name === "logs" && section.included),
      maxFiles: maxLogFiles
    },
    sections
  };
  writeJsonFile(join(bundleDir, "manifest.json"), manifest);
  await writeChecksums(bundleDir);
  return { bundleDir, manifest };
}

function copyAdapterSection(bundleDir: string, dataDir: string, dataRelativePath: string, logDir: string): BackupSection {
  const bundleRelativePath = "adapter";
  const targetDir = join(bundleDir, bundleRelativePath);
  copyDirectoryFiltered(dataDir, targetDir, (sourcePath) => !isSubPath(logDir, sourcePath));
  return {
    name: "adapter",
    sourceRelativePath: dataRelativePath,
    bundleRelativePath: bundleRelativePath.replaceAll("\\", "/"),
    restoreRelativePath: dataRelativePath,
    optional: false,
    included: true,
    fileCount: countFiles(targetDir)
  };
}

function copyConfigSection(bundleDir: string, envFile: string): BackupSection {
  const bundleRelativePath = "config/.env";
  copyPath(envFile, join(bundleDir, "config", ".env"));
  return {
    name: "config",
    sourceRelativePath: ".env",
    bundleRelativePath,
    restoreRelativePath: ".env",
    optional: false,
    included: true,
    fileCount: 1
  };
}

function copyLicenseSection(bundleDir: string, licenseDir: string | null, licenseRelativePath: string | null): BackupSection {
  if (!licenseDir || !licenseRelativePath || !existsSync(licenseDir)) {
    return {
      name: "license",
      sourceRelativePath: licenseRelativePath ?? "",
      bundleRelativePath: "license",
      restoreRelativePath: licenseRelativePath ?? "",
      optional: true,
      included: false,
      fileCount: 0
    };
  }
  const targetPath = join(bundleDir, "license");
  copyPath(licenseDir, targetPath);
  return {
    name: "license",
    sourceRelativePath: licenseRelativePath,
    bundleRelativePath: "license",
    restoreRelativePath: licenseRelativePath,
    optional: true,
    included: true,
    fileCount: countFiles(targetPath)
  };
}

function copyLogSection(
  bundleDir: string,
  logDir: string,
  logRelativePath: string,
  includeLogs: boolean,
  maxLogFiles: number
): BackupSection {
  if (!includeLogs || !existsSync(logDir)) {
    return {
      name: "logs",
      sourceRelativePath: logRelativePath,
      bundleRelativePath: "logs",
      restoreRelativePath: logRelativePath,
      optional: true,
      included: false,
      fileCount: 0
    };
  }
  const selectedFiles = walkFiles(logDir)
    .map((filePath) => ({
      filePath,
      mtimeMs: statSync(filePath).mtimeMs
    }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, maxLogFiles)
    .map((entry) => relative(logDir, entry.filePath));
  const targetDir = join(bundleDir, "logs");
  copySelectedFiles(logDir, targetDir, selectedFiles);
  return {
    name: "logs",
    sourceRelativePath: logRelativePath,
    bundleRelativePath: "logs",
    restoreRelativePath: logRelativePath,
    optional: true,
    included: selectedFiles.length > 0,
    fileCount: selectedFiles.length
  };
}

export async function createBackupBundle(options: {
  rootDir: string;
  outputDir: string;
  mode: BackupMode;
  includeLogs: boolean;
  logFileCount: number;
  restorePointId?: string;
  licenseDir?: string;
}) {
  return createBackup({
    rootDir: options.rootDir,
    backupsDir: options.outputDir,
    mode: options.mode,
    includeLogs: options.includeLogs,
    maxLogFiles: options.logFileCount,
    restorePointId: options.restorePointId,
    licenseDir: options.licenseDir
  });
}
