import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBackup } from "../../../src/ops/backup/backup-create.js";
import { verifyBackup } from "../../../src/ops/backup/backup-verify.js";
import { createBackupFixture, type BackupFixture } from "./backup-test-helper.js";

const fixtures: BackupFixture[] = [];

afterEach(() => {
  while (fixtures.length > 0) {
    fixtures.pop()?.cleanup();
  }
});

describe("backup create and verify", () => {
  it("creates a bundle with manifest, config, state and recent logs", async () => {
    const fixture = createBackupFixture();
    fixtures.push(fixture);

    const result = await createBackup({
      rootDir: fixture.rootDir,
      backupsDir: fixture.backupsDir,
      mode: "nightly",
      includeLogs: true,
      maxLogFiles: 1,
      licenseDir: "./license"
    });

    const adapterSection = result.manifest.sections.find((section) => section.name === "adapter");
    expect(existsSync(join(result.bundleDir, "manifest.json"))).toBe(true);
    expect(existsSync(join(result.bundleDir, "checksums.txt"))).toBe(true);
    expect(existsSync(join(result.bundleDir, adapterSection?.bundleRelativePath ?? "", "dahua-adapter.db"))).toBe(true);
    expect(existsSync(join(result.bundleDir, "adapter", "logs"))).toBe(false);
    expect(existsSync(join(result.bundleDir, "config", ".env"))).toBe(true);
    expect(existsSync(join(result.bundleDir, "license", "license.key"))).toBe(true);
    expect(existsSync(join(result.bundleDir, "logs", "newer.log"))).toBe(true);
    expect(existsSync(join(result.bundleDir, "logs", "older.log"))).toBe(false);

    await expect(
      verifyBackup({
        backupDir: result.bundleDir,
        rootDir: fixture.rootDir
      })
    ).resolves.toMatchObject({
      appVersion: "0.2.0"
    });
  });

  it("fails verification when a bundled file changes", async () => {
    const fixture = createBackupFixture();
    fixtures.push(fixture);

    const result = await createBackup({
      rootDir: fixture.rootDir,
      backupsDir: fixture.backupsDir,
      mode: "nightly",
      includeLogs: false,
      maxLogFiles: 0
    });

    appendFileSync(join(result.bundleDir, "config", ".env"), "\nCHANGED=true\n", "utf8");

    await expect(
      verifyBackup({
        backupDir: result.bundleDir,
        rootDir: fixture.rootDir
      })
    ).rejects.toThrow("checksum mismatch");
  });
});
