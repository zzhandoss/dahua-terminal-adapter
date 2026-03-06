export type BackupMode = "nightly" | "pre-update";

export type BackupSection = "adapter" | "config" | "license" | "logs";

export interface AdapterStatePaths {
  rootDir: string;
  dataDir: string;
  envFile: string;
  logsDir: string;
  licenseDir: string | null;
}

export interface BackupSectionManifest {
  included: boolean;
  relativePath: string;
  sourcePath: string | null;
  fileCount: number;
}

export interface BackupManifest {
  schemaVersion: 1;
  app: {
    name: "dahua-adapter";
    version: string;
  };
  restorePointId: string;
  createdAt: string;
  backupMode: BackupMode;
  checksumAlgorithm: "sha256";
  compatibility: {
    restoreRequiresExactVersion: boolean;
  };
  sections: Record<BackupSection, BackupSectionManifest>;
}

export interface CreateBackupOptions {
  rootDir: string;
  outputDir: string;
  mode: BackupMode;
  includeLogs: boolean;
  logFileCount: number;
  restorePointId?: string;
  licenseDir?: string;
}

export interface CreatedBackupBundle {
  bundleDir: string;
  manifest: BackupManifest;
}

export interface VerifyBackupOptions {
  backupDir: string;
  currentVersion?: string;
  allowVersionMismatch?: boolean;
}

export interface VerifiedBackupBundle {
  backupDir: string;
  manifest: BackupManifest;
}

export interface RestoreBackupOptions {
  backupDir: string;
  rootDir: string;
  safetyRootDir?: string;
  serviceStopped: boolean;
  allowVersionMismatch: boolean;
  licenseDir?: string;
}

export interface RestoredBackupBundle {
  manifest: BackupManifest;
  safetyBundleDir: string;
}

export interface PruneBackupOptions {
  backupsDir: string;
  nightlyKeep: number;
  preUpdateKeep: number;
  logBackupsKeep?: number;
}

export interface PruneBackupResult {
  removedBackupDirs: string[];
  removedLogDirs: string[];
}
