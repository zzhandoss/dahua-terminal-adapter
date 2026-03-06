import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { verifyBackup } from "./backup-verify.js";
import { copyPath, createStamp, ensureDir, replacePath, resolvePath } from "./backup-utils.js";

export interface RestoreBackupOptions {
  backupDir: string;
  rootDir?: string;
  safetyDir?: string;
  allowVersionMismatch?: boolean;
  serviceStopped?: boolean;
}

export interface RestoreBackupResult {
  safetyCopyDir: string;
  restoredPaths: string[];
}

export async function restoreBackup(options: RestoreBackupOptions): Promise<RestoreBackupResult> {
  if (!options.serviceStopped) {
    throw new Error("restore requires explicit serviceStopped confirmation");
  }
  const rootDir = resolvePath(process.cwd(), options.rootDir ?? ".");
  const backupDir = resolvePath(rootDir, options.backupDir);
  const manifest = await verifyBackup({
    backupDir,
    rootDir,
    allowVersionMismatch: options.allowVersionMismatch
  });

  const safetyRoot = resolvePath(rootDir, options.safetyDir ?? "./backups/_safety");
  const safetyCopyDir = join(safetyRoot, `pre-restore-${createStamp()}`);
  const copiedPaths = createSafetyCopy(rootDir, safetyCopyDir, manifest.sections);
  const restoredPaths: string[] = [];
  const logSection = manifest.sections.find((section) => section.name === "logs");
  const adapterSection = manifest.sections.find((section) => section.name === "adapter" && section.included);
  const preservedLogsPath = !logSection?.included && adapterSection && logSection
    ? preserveLogs(rootDir, safetyCopyDir, logSection.restoreRelativePath)
    : null;

  for (const section of manifest.sections) {
    if (!section.included) {
      continue;
    }
    const sourcePath = join(backupDir, section.bundleRelativePath);
    const targetPath = join(rootDir, section.restoreRelativePath);
    replacePath(sourcePath, targetPath);
    restoredPaths.push(section.restoreRelativePath);
  }

  if (preservedLogsPath && logSection) {
    replacePath(preservedLogsPath, join(rootDir, logSection.restoreRelativePath));
  }

  return {
    safetyCopyDir,
    restoredPaths
  };
}

export async function restoreBackupBundle(options: {
  backupDir: string;
  rootDir: string;
  safetyRootDir?: string;
  serviceStopped: boolean;
  allowVersionMismatch: boolean;
}) {
  if (!options.serviceStopped) {
    throw new Error("restore requires --service-stopped confirmation");
  }
  const result = await restoreBackup({
    backupDir: options.backupDir,
    rootDir: options.rootDir,
    safetyDir: options.safetyRootDir,
    allowVersionMismatch: options.allowVersionMismatch,
    serviceStopped: true
  });
  const manifest = await verifyBackup({
    backupDir: options.backupDir,
    rootDir: options.rootDir,
    allowVersionMismatch: options.allowVersionMismatch
  });
  return {
    manifest,
    safetyBundleDir: result.safetyCopyDir
  };
}

function createSafetyCopy(
  rootDir: string,
  safetyCopyDir: string,
  sections: Array<{ bundleRelativePath: string; restoreRelativePath: string; included: boolean }>
): string[] {
  const copiedPaths: string[] = [];
  ensureDir(safetyCopyDir);

  for (const section of sections) {
    if (!section.included) {
      continue;
    }
    const targetPath = join(rootDir, section.restoreRelativePath);
    if (!existsSync(targetPath)) {
      continue;
    }
    copyPath(targetPath, join(safetyCopyDir, section.bundleRelativePath));
    copiedPaths.push(section.restoreRelativePath);
  }

  writeFileSync(
    join(safetyCopyDir, "manifest.json"),
    `${JSON.stringify({ createdAt: new Date().toISOString(), copiedPaths }, null, 2)}\n`,
    "utf8"
  );
  return copiedPaths;
}

function preserveLogs(rootDir: string, safetyCopyDir: string, restoreRelativePath: string): string | null {
  const currentLogPath = join(rootDir, restoreRelativePath);
  if (!existsSync(currentLogPath)) {
    return null;
  }
  const preservedPath = join(safetyCopyDir, "_preserved_logs");
  copyPath(currentLogPath, preservedPath);
  return preservedPath;
}
