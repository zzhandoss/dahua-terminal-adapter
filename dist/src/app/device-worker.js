import { resolveOccurredAtWithPolicy } from "../domain/events/occurred-at.js";
export class DeviceWorker {
    options;
    running = false;
    abortController = null;
    loopPromise = null;
    constructor(options) {
        this.options = options;
    }
    get deviceId() {
        return this.options.assignment.deviceId;
    }
    start() {
        if (this.running) {
            return;
        }
        this.running = true;
        this.loopPromise = this.run();
    }
    async stop() {
        this.running = false;
        this.abortController?.abort();
        if (this.loopPromise) {
            await this.loopPromise;
        }
        this.loopPromise = null;
        this.abortController = null;
    }
    async run() {
        while (this.running) {
            const log = this.options.logger.child({ deviceId: this.options.assignment.deviceId });
            let context = null;
            this.abortController = new AbortController();
            try {
                context = this.options.clientFactory.create(this.options.assignment);
                await context.client.connect();
                for await (const raw of context.client.attachEventStream(context.settings.eventCodes, context.settings.heartbeatSec, this.abortController.signal)) {
                    if (!this.running) {
                        break;
                    }
                    const occurredAtResult = resolveOccurredAtWithPolicy(raw, context.settings.timePolicy);
                    if (occurredAtResult.usedFallback && context.settings.timePolicy.mode === "boundedDevice") {
                        log.warn({ code: raw.code, driftMs: occurredAtResult.driftMs, mode: context.settings.timePolicy.mode }, "device time fallback to adapter clock");
                    }
                    const normalized = this.options.pipeline.normalize(raw, {
                        deviceId: this.options.assignment.deviceId,
                        direction: context.direction,
                        occurredAt: occurredAtResult.occurredAt
                    });
                    if (!normalized) {
                        continue;
                    }
                    this.options.store.upsertEvent(normalized, this.options.retentionMs);
                }
            }
            catch (error) {
                if (!isAbortError(error) || this.running) {
                    log.error({ err: error }, "device worker stream failed");
                }
            }
            finally {
                if (context) {
                    await context.client.close().catch(() => undefined);
                }
            }
            if (this.running) {
                await sleep(this.options.reconnectDelayMs);
            }
        }
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isAbortError(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    return error.name === "AbortError";
}
