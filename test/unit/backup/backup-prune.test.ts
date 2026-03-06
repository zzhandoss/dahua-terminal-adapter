import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBackup } from "../../../src/ops/backup/backup-create.js";
import { readManifest } from "../../../src/ops/backup/backup-manifest.js";
import { pruneBackups } from "../../../src/ops/backup/backup-prune.js";
import { createBackupFixture, type BackupFixture } from "./backup-test-helper.js";

const fixtures: BackupFixture[] = [];

afterEach(() => {
  while (fixtures.length > 0) {
    fixtures.pop()?.cleanup();
  }
});

describe("backup prune", () => {
  it("keeps configured restore points and trims old log attachments separately", async () => {
    const fixture = createBackupFixture();
    fixtures.push(fixture);

    const nightlyOld = await createBackup({
      rootDir: fixture.rootDir,
      backupsDir: fixture.backupsDir,
      mode: "nightly",
      includeLogs: true,
      maxLogFiles: 1,
      now: new Date("2026-03-01T00:00:00.000Z")
    });

    const nightlyNew = await createBackup({
      rootDir: fixture.rootDir,
      backupsDir: fixture.backupsDir,
      mode: "nightly",
      includeLogs: true,
      maxLogFiles: 1,
      now: new Date("2026-03-02T00:00:00.000Z")
    });

    const preUpdate = await createBackup({
      rootDir: fixture.rootDir,
      backupsDir: fixture.backupsDir,
      mode: "pre-update",
      includeLogs: true,
      maxLogFiles: 1,
      now: new Date("2026-03-03T00:00:00.000Z")
    });

    const result = await pruneBackups({
      backupsDir: fixture.backupsDir,
      nightlyKeep: 1,
      preUpdateKeep: 1,
      logBackupsKeep: 1
    });

    expect(existsSync(nightlyOld.bundleDir)).toBe(false);
    expect(existsSync(nightlyNew.bundleDir)).toBe(true);
    expect(existsSync(preUpdate.bundleDir)).toBe(true);
    expect(result.removed).toContain(nightlyOld.bundleDir);
    const keptBundles = [nightlyNew.bundleDir, preUpdate.bundleDir];
    const trimmedBundles = keptBundles.filter((bundleDir) => {
      const logSection = readManifest(bundleDir).sections.find((section) => section.name === "logs");
      return logSection?.included === false;
    });
    expect(trimmedBundles.length).toBe(1);
    const trimmedBundleDir = trimmedBundles[0]!;
    const trimmedLogSection = readManifest(trimmedBundleDir).sections.find((section) => section.name === "logs");
    expect(existsSync(join(trimmedBundleDir, trimmedLogSection?.bundleRelativePath ?? ""))).toBe(false);
  });
});
