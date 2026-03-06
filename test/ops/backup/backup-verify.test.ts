import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { createBackup } from "../../../src/ops/backup/backup-create.js";
import { verifyBackup } from "../../../src/ops/backup/backup-verify.js";

const cleanupPaths: string[] = [];

afterEach(() => {
  while (cleanupPaths.length > 0) {
    rmSync(cleanupPaths.pop() as string, { recursive: true, force: true });
  }
});

describe("verifyBackup", () => {
  it("accepts a valid restore point", async () => {
    const rootDir = createFixture("1.2.3");
    const { bundleDir } = await createBackup({ rootDir, mode: "nightly" });

    const manifest = await verifyBackup({ rootDir, backupDir: bundleDir });

    expect(manifest.appVersion).toBe("1.2.3");
  });

  it("fails on checksum mismatch", async () => {
    const rootDir = createFixture("1.2.3");
    const { bundleDir } = await createBackup({ rootDir, mode: "nightly" });
    writeFileSync(join(bundleDir, "config", ".env"), "tampered\n", "utf8");

    await expect(verifyBackup({ rootDir, backupDir: bundleDir })).rejects.toThrow("checksum mismatch");
  });

  it("fails on version mismatch unless explicitly allowed", async () => {
    const rootDir = createFixture("1.2.3");
    const { bundleDir } = await createBackup({ rootDir, mode: "nightly" });
    writeFileSync(join(rootDir, "package.json"), JSON.stringify({ version: "2.0.0" }), "utf8");

    await expect(verifyBackup({ rootDir, backupDir: bundleDir })).rejects.toThrow("backup version");
    await expect(
      verifyBackup({ rootDir, backupDir: bundleDir, allowVersionMismatch: true })
    ).resolves.toBeDefined();
  });
});

function createFixture(version: string): string {
  const rootDir = mkdtempSync(join(tmpdir(), "dahua-backup-verify-"));
  cleanupPaths.push(rootDir);
  mkdirSync(join(rootDir, "data"), { recursive: true });
  writeFileSync(join(rootDir, "package.json"), JSON.stringify({ version }), "utf8");
  writeFileSync(join(rootDir, ".env"), "SQLITE_PATH=./data/dahua-adapter.db\n", "utf8");
  writeFileSync(join(rootDir, "data", "dahua-adapter.db"), "db", "utf8");
  writeFileSync(join(rootDir, "data", "dahua-adapter.db-wal"), "wal", "utf8");
  writeFileSync(join(rootDir, "data", "dahua-adapter.db-shm"), "shm", "utf8");
  return rootDir;
}
