import { PermanentDeviceServiceError } from "../../infra/ds/device-service-client.js";
import { shouldReRegister } from "../runtime-lease.js";
export class DeliveryService {
    store;
    dsClient;
    metrics;
    logger;
    constructor(store, dsClient, metrics, logger) {
        this.store = store;
        this.dsClient = dsClient;
        this.metrics = metrics;
        this.logger = logger;
    }
    async deliverPending(context, hooks) {
        if (!context.running || !context.adapterId) {
            return;
        }
        const pending = this.store.listPending(context.batchLimit);
        if (pending.length === 0) {
            return;
        }
        this.logger.info({
            adapterId: context.adapterId,
            batchSize: pending.length,
            batchLimit: context.batchLimit
        }, "queue delivery started");
        try {
            const payload = this.buildIngestPayload(context.adapterId, pending);
            const response = await this.dsClient.ingestEvents(payload);
            this.applyAckResults(pending, response.results);
            this.logger.info({
                adapterId: context.adapterId,
                requested: pending.length,
                processed: response.results.length
            }, "queue delivery completed");
        }
        catch (error) {
            if (error instanceof PermanentDeviceServiceError) {
                if (shouldReRegister(error)) {
                    await hooks.onNeedReRegister(error);
                }
                this.logger.error({ err: error }, "ingest failed with permanent error");
                return;
            }
            this.metrics.markFailure();
            this.logger.warn({ err: error }, "ingest temporary failure");
        }
    }
    buildIngestPayload(adapterId, pending) {
        return {
            adapterId,
            events: pending.map((item) => ({
                eventId: item.eventId,
                deviceId: item.deviceId,
                direction: item.direction,
                occurredAt: item.occurredAt,
                terminalPersonId: item.terminalPersonId,
                rawPayload: item.rawPayload
            }))
        };
    }
    applyAckResults(pending, results) {
        for (const result of results) {
            if (!this.shouldAckResult(result)) {
                continue;
            }
            const event = pending.find((item) => item.eventId === result.eventId);
            if (!event) {
                continue;
            }
            this.store.markAcked(event.deviceId, event.eventId);
        }
    }
    shouldAckResult(result) {
        return result.result === "inserted" || result.result === "duplicate";
    }
}
