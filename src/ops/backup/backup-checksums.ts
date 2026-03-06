import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { readManifest, type BackupManifest } from "./backup-manifest.js";
import type { BackupManifest as LegacyBackupManifest, BackupSection as LegacySection } from "./backup-types.js";
import { sha256File, toPosixPath, walkFiles, writeJsonFile } from "./backup-utils.js";

const CHECKSUMS_FILE = "checksums.txt";

export async function writeChecksums(bundleDir: string): Promise<void> {
  const lines: string[] = [];
  for (const relativePath of listBundleFiles(bundleDir)) {
    const absolutePath = join(bundleDir, relativePath);
    lines.push(`${await sha256File(absolutePath)}  ${relativePath}`);
  }
  writeFileSync(join(bundleDir, CHECKSUMS_FILE), `${lines.join("\n")}\n`, "utf8");
}

export async function verifyChecksums(bundleDir: string): Promise<void> {
  const checksumsPath = join(bundleDir, CHECKSUMS_FILE);
  if (!existsSync(checksumsPath)) {
    throw new Error(`missing ${CHECKSUMS_FILE} in ${bundleDir}`);
  }
  const expectedEntries = readChecksumEntries(checksumsPath);
  const actualFiles = listBundleFiles(bundleDir);
  if (expectedEntries.length !== actualFiles.length) {
    throw new Error(`checksum file count mismatch in ${bundleDir}`);
  }
  for (const relativePath of actualFiles) {
    if (!expectedEntries.some((entry) => entry.path === relativePath)) {
      throw new Error(`checksum entry missing for ${relativePath}`);
    }
  }
  for (const entry of expectedEntries) {
    const actualHash = await sha256File(join(bundleDir, entry.path));
    if (actualHash !== entry.hash) {
      throw new Error(`checksum mismatch for ${entry.path}`);
    }
  }
}

export function readBundleManifest(bundleDir: string): LegacyBackupManifest {
  return toLegacyManifest(readManifest(bundleDir));
}

export async function writeBundleMetadata(
  bundleDir: string,
  manifest: LegacyBackupManifest | BackupManifest
): Promise<void> {
  const normalized = "app" in manifest ? fromLegacyManifest(manifest) : manifest;
  writeJsonFile(join(bundleDir, "manifest.json"), normalized);
  await writeChecksums(bundleDir);
}

function listBundleFiles(bundleDir: string): string[] {
  return walkFiles(bundleDir)
    .map((filePath) => toPosixPath(relative(bundleDir, filePath)))
    .filter((relativePath) => relativePath !== CHECKSUMS_FILE)
    .sort();
}

function readChecksumEntries(filePath: string): Array<{ hash: string; path: string }> {
  return readFileSync(filePath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
      if (!match) {
        throw new Error(`invalid checksum line: ${line}`);
      }
      return {
        hash: match[1],
        path: match[2]
      };
    });
}

function toLegacyManifest(manifest: BackupManifest): LegacyBackupManifest {
  const sections = Object.fromEntries(
    (["adapter", "config", "license", "logs"] as LegacySection[]).map((name) => {
      const section = manifest.sections.find((item) => item.name === name);
      return [
        name,
        {
          included: section?.included ?? false,
          relativePath: section?.restoreRelativePath ?? "",
          sourcePath: null,
          fileCount: section?.fileCount ?? 0
        }
      ];
    })
  ) as LegacyBackupManifest["sections"];

  return {
    schemaVersion: 1,
    app: {
      name: "dahua-adapter",
      version: manifest.appVersion
    },
    restorePointId: manifest.restorePointId,
    createdAt: manifest.createdAt,
    backupMode: manifest.backupMode,
    checksumAlgorithm: "sha256",
    compatibility: {
      restoreRequiresExactVersion: manifest.compatibility.policy === "exactVersion"
    },
    sections
  };
}

function fromLegacyManifest(manifest: LegacyBackupManifest): BackupManifest {
  const bundleRelativePathBySection: Record<LegacySection, string> = {
    adapter: "adapter",
    config: "config/.env",
    license: "license",
    logs: "logs"
  };

  return {
    schemaVersion: 1,
    restorePointId: manifest.restorePointId,
    createdAt: manifest.createdAt,
    backupMode: manifest.backupMode,
    appVersion: manifest.app.version,
    nodeVersion: process.version,
    platform: process.platform,
    checksumAlgorithm: "sha256",
    compatibility: {
      policy: "exactVersion",
      appVersion: manifest.app.version
    },
    logCapture: {
      included: manifest.sections.logs.included,
      maxFiles: manifest.sections.logs.fileCount
    },
    sections: (Object.keys(manifest.sections) as LegacySection[]).map((name) => ({
      name,
      sourceRelativePath: manifest.sections[name].relativePath,
      bundleRelativePath: bundleRelativePathBySection[name],
      restoreRelativePath: manifest.sections[name].relativePath,
      optional: name === "license" || name === "logs",
      included: manifest.sections[name].included,
      fileCount: manifest.sections[name].fileCount
    }))
  };
}
