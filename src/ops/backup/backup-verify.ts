import { existsSync } from "node:fs";
import { join } from "node:path";
import { readManifest } from "./backup-manifest.js";
import { verifyChecksums } from "./backup-checksums.js";
import { readPackageVersion, resolvePath } from "./backup-utils.js";

export interface VerifyBackupOptions {
  backupDir: string;
  rootDir?: string;
  currentVersion?: string;
  allowVersionMismatch?: boolean;
}

export async function verifyBackup(options: VerifyBackupOptions) {
  const rootDir = resolvePath(process.cwd(), options.rootDir ?? ".");
  const backupDir = resolvePath(rootDir, options.backupDir);
  const manifest = readManifest(backupDir);

  for (const section of manifest.sections) {
    if (!section.included) {
      continue;
    }
    if (!existsSync(join(backupDir, section.bundleRelativePath))) {
      throw new Error(`missing bundled section ${section.bundleRelativePath}`);
    }
  }

  if (!options.allowVersionMismatch) {
    const currentVersion = options.currentVersion ?? readPackageVersion(rootDir);
    if (currentVersion !== manifest.compatibility.appVersion) {
      throw new Error(
        `backup version ${manifest.compatibility.appVersion} does not match current version ${currentVersion}`
      );
    }
  }

  await verifyChecksums(backupDir);
  return manifest;
}

export async function verifyBackupBundle(options: VerifyBackupOptions) {
  return {
    backupDir: resolvePath(process.cwd(), options.backupDir),
    manifest: await verifyBackup(options)
  };
}
