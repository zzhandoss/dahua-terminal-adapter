import pino from "pino";
import { parseBooleanLike } from "./env-parse.js";
const isDev = (process.env.NODE_ENV ?? "development") === "development";
const usePretty = parseBooleanLike(process.env.LOG_PRETTY, isDev);
export const logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    ...(usePretty
        ? {
            transport: {
                target: "pino-pretty",
                options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: "SYS:standard"
                }
            }
        }
        : {})
});
