import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface BackupFixture {
  rootDir: string;
  backupsDir: string;
  cleanup: () => void;
}

export function createBackupFixture(): BackupFixture {
  const rootDir = mkdtempSync(join(tmpdir(), "dahua-adapter-backup-"));
  const dataDir = join(rootDir, "data");
  const logsDir = join(dataDir, "logs");
  const licenseDir = join(rootDir, "license");
  const backupsDir = join(rootDir, "backups");

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(licenseDir, { recursive: true });
  mkdirSync(backupsDir, { recursive: true });

  writeFileSync(
    join(rootDir, "package.json"),
    JSON.stringify({ name: "dahua-adapter", version: "0.2.0" }, null, 2),
    "utf8"
  );
  writeFileSync(
    join(rootDir, ".env"),
    [
      "SQLITE_PATH=./data/dahua-adapter.db",
      "LOG_DIR=./data/logs"
    ].join("\n"),
    "utf8"
  );
  writeFileSync(join(dataDir, "dahua-adapter.db"), "db", "utf8");
  writeFileSync(join(dataDir, "dahua-adapter.db-wal"), "wal", "utf8");
  writeFileSync(join(dataDir, "dahua-adapter.db-shm"), "shm", "utf8");
  writeFileSync(join(logsDir, "older.log"), "older", "utf8");
  writeFileSync(join(logsDir, "newer.log"), "newer", "utf8");
  writeFileSync(join(licenseDir, "license.key"), "license", "utf8");

  const earlier = new Date("2026-03-01T00:00:00.000Z");
  const later = new Date("2026-03-02T00:00:00.000Z");
  utimesSync(join(logsDir, "older.log"), earlier, earlier);
  utimesSync(join(logsDir, "newer.log"), later, later);

  return {
    rootDir,
    backupsDir,
    cleanup: () => rmSync(rootDir, { recursive: true, force: true })
  };
}
