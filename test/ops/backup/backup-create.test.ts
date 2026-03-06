import { mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { createBackup } from "../../../src/ops/backup/backup-create.js";
import { readManifest } from "../../../src/ops/backup/backup-manifest.js";

const cleanupPaths: string[] = [];

afterEach(() => {
  while (cleanupPaths.length > 0) {
    rmSync(cleanupPaths.pop() as string, { recursive: true, force: true });
  }
});

describe("createBackup", () => {
  it("creates a restore point with manifest, config, state and recent logs", async () => {
    const rootDir = createFixture();

    const { bundleDir } = await createBackup({
      rootDir,
      mode: "nightly",
      includeLogs: true,
      maxLogFiles: 2,
      licenseDir: "license"
    });

    const manifest = readManifest(bundleDir);
    const adapterSection = manifest.sections.find((section) => section.name === "adapter");
    expect(manifest.backupMode).toBe("nightly");
    expect(manifest.sections.find((section) => section.name === "adapter")?.fileCount).toBe(3);
    expect(manifest.sections.find((section) => section.name === "logs")?.fileCount).toBe(2);
    expect(existsSync(join(bundleDir, adapterSection?.bundleRelativePath ?? "", "dahua-adapter.db"))).toBe(true);
    expect(existsSync(join(bundleDir, adapterSection?.bundleRelativePath ?? "", "logs"))).toBe(false);
    expect(existsSync(join(bundleDir, "config", ".env"))).toBe(true);
    expect(existsSync(join(bundleDir, "license", "license.key"))).toBe(true);
    expect(existsSync(join(bundleDir, "logs", "adapter-2.log"))).toBe(true);
    expect(existsSync(join(bundleDir, "logs", "adapter-3.log"))).toBe(true);
    expect(existsSync(join(bundleDir, "logs", "adapter-1.log"))).toBe(false);
    expect(readFileSync(join(bundleDir, "checksums.txt"), "utf8")).toContain("manifest.json");
  });
});

function createFixture(): string {
  const rootDir = mkdtempSync(join(tmpdir(), "dahua-backup-create-"));
  cleanupPaths.push(rootDir);
  mkdirSync(join(rootDir, "data", "logs"), { recursive: true });
  mkdirSync(join(rootDir, "license"), { recursive: true });
  writeFileSync(join(rootDir, "package.json"), JSON.stringify({ version: "1.2.3" }), "utf8");
  writeFileSync(
    join(rootDir, ".env"),
    "SQLITE_PATH=./data/dahua-adapter.db\nLOG_DIR=./data/logs\n",
    "utf8"
  );
  writeFileSync(join(rootDir, "data", "dahua-adapter.db"), "db", "utf8");
  writeFileSync(join(rootDir, "data", "dahua-adapter.db-wal"), "wal", "utf8");
  writeFileSync(join(rootDir, "data", "dahua-adapter.db-shm"), "shm", "utf8");
  writeFileSync(join(rootDir, "license", "license.key"), "license", "utf8");
  writeLog(rootDir, "adapter-1.log", 1_000);
  writeLog(rootDir, "adapter-2.log", 2_000);
  writeLog(rootDir, "adapter-3.log", 3_000);
  return rootDir;
}

function writeLog(rootDir: string, fileName: string, mtimeMs: number): void {
  const filePath = join(rootDir, "data", "logs", fileName);
  writeFileSync(filePath, fileName, "utf8");
  const stamp = new Date(mtimeMs);
  utimesSync(filePath, stamp, stamp);
}
