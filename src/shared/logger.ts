import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import pino, { type DestinationStream, type LoggerOptions } from "pino";
import { parseBooleanLike } from "./env-parse.js";

type LogOutput = "auto" | "pretty" | "console" | "file";

type ClosableDestination = DestinationStream & {
  end?: () => void;
  flushSync?: () => void;
};

const isDev = (process.env.NODE_ENV ?? "development") === "development";
const configuredOutput = process.env.LOG_OUTPUT as LogOutput | undefined;
const usePretty = parseBooleanLike(process.env.LOG_PRETTY, isDev);
const logOutput = resolveLogOutput(configuredOutput, usePretty, isDev);
const destination = logOutput === "file" ? createFileDestination() : undefined;

export const logger = pino(buildLoggerOptions(logOutput), destination);

export function closeLogger(): void {
  destination?.flushSync?.();
  destination?.end?.();
}

function resolveLogOutput(
  value: LogOutput | undefined,
  prettyEnabled: boolean,
  devMode: boolean
): LogOutput {
  if (value && value !== "auto") {
    return value;
  }
  if (!devMode) {
    return "file";
  }
  return prettyEnabled ? "pretty" : "console";
}

function buildLoggerOptions(output: LogOutput): LoggerOptions {
  if (output === "pretty") {
    return {
      level: process.env.LOG_LEVEL ?? "info",
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          singleLine: true,
          translateTime: "SYS:standard"
        }
      }
    };
  }
  return {
    level: process.env.LOG_LEVEL ?? "info"
  };
}

function createFileDestination(): ClosableDestination {
  const directory = resolve(process.cwd(), process.env.LOG_DIR ?? "./data/logs");
  mkdirSync(directory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return pino.destination({
    dest: join(directory, `dahua-adapter-${timestamp}.log`),
    mkdir: true,
    sync: false
  }) as ClosableDestination;
}
