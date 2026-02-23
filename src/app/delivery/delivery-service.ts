import type { Logger } from "pino";
import type { AdapterEventsInput, AdapterEventsResult } from "../../contracts/device-service.js";
import { PermanentDeviceServiceError, type DeviceServiceClient } from "../../infra/ds/device-service-client.js";
import type { SqliteStore, StoredEvent } from "../../infra/store/sqlite-store.js";
import type { RuntimeMetrics } from "../runtime-metrics.js";
import { shouldReRegister } from "../runtime-lease.js";

export type DeliveryContext = {
  running: boolean;
  adapterId: string | null;
  batchLimit: number;
};

export type DeliveryHooks = {
  onNeedReRegister(error: unknown): Promise<void>;
};

export class DeliveryService {
  constructor(
    private readonly store: SqliteStore,
    private readonly dsClient: DeviceServiceClient,
    private readonly metrics: RuntimeMetrics,
    private readonly logger: Logger
  ) {}

  async deliverPending(context: DeliveryContext, hooks: DeliveryHooks): Promise<void> {
    if (!context.running || !context.adapterId) {
      return;
    }

    const pending = this.store.listPending(context.batchLimit);
    if (pending.length === 0) {
      return;
    }

    this.logger.info(
      {
        adapterId: context.adapterId,
        batchSize: pending.length,
        batchLimit: context.batchLimit
      },
      "queue delivery started"
    );

    try {
      const payload = this.buildIngestPayload(context.adapterId, pending);
      const response = await this.dsClient.ingestEvents(payload);
      this.applyAckResults(pending, response.results);
      this.logger.info(
        {
          adapterId: context.adapterId,
          requested: pending.length,
          processed: response.results.length
        },
        "queue delivery completed"
      );
    } catch (error) {
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

  private buildIngestPayload(adapterId: string, pending: StoredEvent[]): AdapterEventsInput {
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

  private applyAckResults(pending: StoredEvent[], results: AdapterEventsResult[]): void {
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

  private shouldAckResult(result: AdapterEventsResult): boolean {
    return result.result === "inserted" || result.result === "duplicate";
  }
}

