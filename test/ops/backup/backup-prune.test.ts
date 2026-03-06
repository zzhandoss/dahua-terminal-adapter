import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { createBackup } from "../../../src/ops/backup/backup-create.js";
import { pruneBackups } from "../../../src/ops/backup/backup-prune.js";

const cleanupPaths: string[] = [];

afterEach(() => {
  while (cleanupPaths.length > 0) {
    rmSync(cleanupPaths.pop() as string, { recursive: true, force: true });
  }
});

describe("pruneBackups", () => {
  it("keeps the newest restore points per mode", async () => {
    const rootDir = createFixture();
    const nightly1 = await createBackup({ rootDir, mode: "nightly", now: new Date("2026-03-01T00:00:00.000Z") });
    const nightly2 = await createBackup({ rootDir, mode: "nightly", now: new Date("2026-03-02T00:00:00.000Z") });
    const pre1 = await createBackup({ rootDir, mode: "pre-update", now: new Date("2026-03-03T00:00:00.000Z") });
    const pre2 = await createBackup({ rootDir, mode: "pre-update", now: new Date("2026-03-04T00:00:00.000Z") });

    const result = await pruneBackups({
      rootDir,
      nightlyKeep: 1,
      preUpdateKeep: 1
    });

    expect(result.removed).toContain(nightly1.bundleDir);
    expect(result.removed).toContain(pre1.bundleDir);
    expect(existsSync(nightly1.bundleDir)).toBe(false);
    expect(existsSync(pre1.bundleDir)).toBe(false);
    expect(existsSync(nightly2.bundleDir)).toBe(true);
    expect(existsSync(pre2.bundleDir)).toBe(true);
  });
});

function createFixture(): string {
  const rootDir = mkdtempSync(join(tmpdir(), "dahua-backup-prune-"));
  cleanupPaths.push(rootDir);
  mkdirSync(join(rootDir, "data"), { recursive: true });
  writeFileSync(join(rootDir, "package.json"), JSON.stringify({ version: "1.2.3" }), "utf8");
  writeFileSync(join(rootDir, ".env"), "SQLITE_PATH=./data/dahua-adapter.db\n", "utf8");
  writeFileSync(join(rootDir, "data", "dahua-adapter.db"), "db", "utf8");
  writeFileSync(join(rootDir, "data", "dahua-adapter.db-wal"), "wal", "utf8");
  writeFileSync(join(rootDir, "data", "dahua-adapter.db-shm"), "shm", "utf8");
  return rootDir;
}
