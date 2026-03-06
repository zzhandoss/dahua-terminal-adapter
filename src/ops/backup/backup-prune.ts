import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { writeChecksums } from "./backup-checksums.js";
import { BackupMode, readManifest } from "./backup-manifest.js";
import { resolvePath, writeJsonFile } from "./backup-utils.js";

export interface PruneBackupsOptions {
  rootDir?: string;
  backupsDir?: string;
  nightlyKeep: number;
  preUpdateKeep: number;
  logBackupsKeep?: number;
}

export interface PruneBackupsResult {
  removed: string[];
  trimmedLogs: string[];
}

export async function pruneBackups(options: PruneBackupsOptions): Promise<PruneBackupsResult> {
  const rootDir = resolvePath(process.cwd(), options.rootDir ?? ".");
  const backupsDir = resolvePath(rootDir, options.backupsDir ?? "./backups");
  if (!existsSync(backupsDir)) {
    return { removed: [], trimmedLogs: [] };
  }

  const groups = new Map<BackupMode, Array<{ dirPath: string; createdAt: string }>>([
    ["nightly", []],
    ["pre-update", []]
  ]);

  for (const entry of readdirSync(backupsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) {
      continue;
    }
    const dirPath = join(backupsDir, entry.name);
    try {
      const manifest = readManifest(dirPath);
      groups.get(manifest.backupMode)?.push({ dirPath, createdAt: manifest.createdAt });
    } catch {
      continue;
    }
  }

  const removed: string[] = [];
  removed.push(...pruneGroup(groups.get("nightly") ?? [], options.nightlyKeep));
  removed.push(...pruneGroup(groups.get("pre-update") ?? [], options.preUpdateKeep));
  const trimmedLogs = options.logBackupsKeep === undefined
    ? []
    : await trimLogs(
        Array.from(groups.values())
          .flat()
          .filter((item) => !removed.includes(item.dirPath)),
        options.logBackupsKeep
      );
  return { removed, trimmedLogs };
}

function pruneGroup(items: Array<{ dirPath: string; createdAt: string }>, keep: number): string[] {
  return items
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(Math.max(keep, 0))
    .map((item) => {
      rmSync(item.dirPath, { recursive: true, force: true });
      return item.dirPath;
    });
}

export async function pruneBackupBundles(options: {
  backupsDir: string;
  nightlyKeep: number;
  preUpdateKeep: number;
  logBackupsKeep?: number;
}) {
  const result = await pruneBackups({
    backupsDir: options.backupsDir,
    nightlyKeep: options.nightlyKeep,
    preUpdateKeep: options.preUpdateKeep,
    logBackupsKeep: options.logBackupsKeep
  });
  return {
    removedBackupDirs: result.removed,
    removedLogDirs: result.trimmedLogs
  };
}

async function trimLogs(items: Array<{ dirPath: string; createdAt: string }>, keep: number): Promise<string[]> {
  if (keep < 0) {
    throw new Error("logBackupsKeep must be >= 0");
  }

  const removed: string[] = [];
  const candidates = items
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(keep);

  for (const candidate of candidates) {
    const manifest = readManifest(candidate.dirPath);
    const logSection = manifest.sections.find((section) => section.name === "logs");
    if (!logSection?.included) {
      continue;
    }
    const logDir = join(candidate.dirPath, logSection.bundleRelativePath);
    if (!existsSync(logDir)) {
      continue;
    }
    rmSync(logDir, { recursive: true, force: true });
    logSection.included = false;
    logSection.fileCount = 0;
    manifest.logCapture.included = false;
    writeJsonFile(join(candidate.dirPath, "manifest.json"), manifest);
    await writeChecksums(candidate.dirPath);
    removed.push(logDir);
  }

  return removed;
}
