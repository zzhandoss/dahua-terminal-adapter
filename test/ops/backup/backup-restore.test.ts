import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { createBackup } from "../../../src/ops/backup/backup-create.js";
import { readManifest } from "../../../src/ops/backup/backup-manifest.js";
import { restoreBackup } from "../../../src/ops/backup/backup-restore.js";

const cleanupPaths: string[] = [];

afterEach(() => {
  while (cleanupPaths.length > 0) {
    rmSync(cleanupPaths.pop() as string, { recursive: true, force: true });
  }
});

describe("restoreBackup", () => {
  it("restores state and keeps a safety copy of current files", async () => {
    const rootDir = createFixture();
    const { bundleDir } = await createBackup({
      rootDir,
      mode: "pre-update",
      includeLogs: true,
      maxLogFiles: 1,
      licenseDir: "license"
    });

    writeFileSync(join(rootDir, ".env"), "SQLITE_PATH=./data/dahua-adapter.db\nLOG_DIR=./data/logs\nCHANGED=true\n", "utf8");
    writeFileSync(join(rootDir, "data", "dahua-adapter.db"), "changed", "utf8");
    writeFileSync(join(rootDir, "license", "license.key"), "changed-license", "utf8");

    const result = await restoreBackup({ rootDir, backupDir: bundleDir, serviceStopped: true });
    const adapterSection = readManifest(bundleDir).sections.find((section) => section.name === "adapter");

    expect(readFileSync(join(rootDir, "data", "dahua-adapter.db"), "utf8")).toBe("db");
    expect(readFileSync(join(rootDir, ".env"), "utf8")).toContain("LOG_DIR=./data/logs");
    expect(readFileSync(join(rootDir, "license", "license.key"), "utf8")).toBe("license");
    expect(existsSync(join(result.safetyCopyDir, "config", ".env"))).toBe(true);
    expect(existsSync(join(result.safetyCopyDir, adapterSection?.bundleRelativePath ?? "", "dahua-adapter.db"))).toBe(true);
  });
});

function createFixture(): string {
  const rootDir = mkdtempSync(join(tmpdir(), "dahua-backup-restore-"));
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
  writeFileSync(join(rootDir, "data", "logs", "adapter.log"), "log", "utf8");
  writeFileSync(join(rootDir, "license", "license.key"), "license", "utf8");
  return rootDir;
}
