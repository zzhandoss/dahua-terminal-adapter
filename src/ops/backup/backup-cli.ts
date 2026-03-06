import { createBackup } from "./backup-create.js";
import { pruneBackupBundles } from "./backup-prune.js";
import { restoreBackup } from "./backup-restore.js";
import { verifyBackup } from "./backup-verify.js";

type CliOptions = Record<string, string | boolean>;

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const options = parseOptions(rest);

  switch (command) {
    case "create":
      printResult(
        await createBackup({
          rootDir: readString(options, "root"),
          backupsDir: readString(options, "backups-dir"),
          licenseDir: readString(options, "license-dir"),
          includeLogs: readBoolean(options, "include-logs", false),
          maxLogFiles: readNumber(options, "max-log-files", 5),
          mode: readMode(options, "mode", "nightly"),
          restorePointId: readString(options, "restore-point-id")
        })
      );
      return;
    case "verify":
      printResult(
        await verifyBackup({
          backupDir: requireString(options, "backup"),
          rootDir: readString(options, "root"),
          allowVersionMismatch: readBoolean(options, "allow-version-mismatch", false)
        })
      );
      return;
    case "restore":
      printResult(
        await restoreBackup({
          backupDir: requireString(options, "backup"),
          rootDir: readString(options, "root"),
          safetyDir: readString(options, "safety-dir"),
          serviceStopped: readBoolean(options, "service-stopped", false),
          allowVersionMismatch: readBoolean(options, "allow-version-mismatch", false)
        })
      );
      return;
    case "prune":
      printResult(
        await pruneBackupBundles({
          backupsDir: requireString(options, "backups-dir"),
          nightlyKeep: readNumber(options, "nightly-keep", 7),
          preUpdateKeep: readNumber(options, "pre-update-keep", 5),
          logBackupsKeep: readOptionalNumber(options, "log-backups-keep")
        })
      );
      return;
    default:
      throw new Error("usage: backup-cli <create|verify|restore|prune> [options]");
  }
}

function parseOptions(args: string[]): CliOptions {
  const options: CliOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--") {
      continue;
    }
    if (!token?.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return options;
}

function readMode(options: CliOptions, key: string, fallback: "nightly" | "pre-update") {
  const value = readString(options, key) ?? fallback;
  if (value !== "nightly" && value !== "pre-update") {
    throw new Error(`invalid mode: ${value}`);
  }
  return value;
}

function readString(options: CliOptions, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}

function requireString(options: CliOptions, key: string): string {
  const value = readString(options, key);
  if (!value) {
    throw new Error(`missing --${key}`);
  }
  return value;
}

function readBoolean(options: CliOptions, key: string, fallback: boolean): boolean {
  const value = options[key];
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return value === "true";
}

function readNumber(options: CliOptions, key: string, fallback: number): number {
  const value = readString(options, key);
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`invalid --${key}: ${value}`);
  }
  return parsed;
}

function readOptionalNumber(options: CliOptions, key: string): number | undefined {
  const value = readString(options, key);
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`invalid --${key}: ${value}`);
  }
  return parsed;
}

function printResult(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
