import { afterEach, describe, expect, it } from "vitest";
import { createBackup } from "../../../src/ops/backup/backup-create.js";
import { restoreBackup } from "../../../src/ops/backup/backup-restore.js";
import { createBackupFixture, type BackupFixture } from "./backup-test-helper.js";

const fixtures: BackupFixture[] = [];

afterEach(() => {
  while (fixtures.length > 0) {
    fixtures.pop()?.cleanup();
  }
});

describe("backup restore", () => {
  it("rejects restore when service stop is not confirmed", async () => {
    const fixture = createBackupFixture();
    fixtures.push(fixture);

    const bundle = await createBackup({
      rootDir: fixture.rootDir,
      backupsDir: fixture.backupsDir,
      mode: "nightly",
      includeLogs: false,
      maxLogFiles: 0
    });

    await expect(
      restoreBackup({
        backupDir: bundle.bundleDir,
        rootDir: fixture.rootDir,
        serviceStopped: false,
        allowVersionMismatch: false
      })
    ).rejects.toThrow("restore requires explicit serviceStopped confirmation");
  });
});
