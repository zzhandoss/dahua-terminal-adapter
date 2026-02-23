import type { Logger } from "pino";
import type { AppEnv } from "../config/env.js";
import type {
  AdapterLease,
  BackfillRequest,
  DeviceDirection,
  IdentityExportUser,
  IdentityFindMatch,
  IdentityFindRequest,
  NormalizedEvent
} from "../contracts/device-service.js";
import { BackfillService } from "../domain/backfill/backfill-service.js";
import { IdentityFindService } from "../domain/identity-find/identity-find-service.js";
import type { EventNormalizationPipeline } from "../domain/events/event-normalization-pipeline.js";
import { DeviceServiceClient } from "../infra/ds/device-service-client.js";
import type { SqliteStore } from "../infra/store/sqlite-store.js";
import { MockPersonStore } from "../infra/mock/person-store.js";
import { AssignmentRegistry } from "./assignment-registry.js";
import { DahuaClientFactory } from "./dahua-client-factory.js";
import { PushAuthRegistry, type PushAuthIdentity } from "./push-auth-registry.js";
import { RuntimeMetrics } from "./runtime-metrics.js";
import { registerWithRetry, shouldReRegister } from "./runtime-lease.js";
import { MockPushEmitter } from "../infra/mock/mock-push-emitter.js";
import { DeliveryService } from "./delivery/delivery-service.js";

export class AdapterRuntime {
  private adapterId: string | null = null;
  private mode: "active" | "draining" = "active";
  private batchLimit = 100;
  private heartbeatIntervalMs: number;
  private deliveryTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private purgeTimer: NodeJS.Timeout | null = null;
  private running = false;
  private heartbeatBusy = false;
  private deliveryBusy = false;
  private reRegisterPromise: Promise<void> | null = null;
  private readonly assignments = new AssignmentRegistry();
  private readonly pushAuth = new PushAuthRegistry();
  private readonly metrics = new RuntimeMetrics();
  private readonly clientFactory: DahuaClientFactory;
  private readonly backfillService: BackfillService;
  private readonly identityFindService: IdentityFindService;
  private readonly deliveryService: DeliveryService;
  private readonly mockEmitter: MockPushEmitter | null;

  constructor(
    private readonly env: AppEnv,
    private readonly dsClient: DeviceServiceClient,
    private readonly store: SqliteStore,
    private readonly _pipeline: EventNormalizationPipeline,
    private readonly logger: Logger
  ) {
    this.heartbeatIntervalMs = env.HEARTBEAT_INTERVAL_MS;
    const personStore = env.MOCK_ENABLED ? new MockPersonStore() : undefined;
    this.clientFactory = new DahuaClientFactory({
      requestTimeoutMs: env.HTTP_TIMEOUT_MS,
      rejectUnauthorized: env.REJECT_UNAUTHORIZED,
      mockEnabled: env.MOCK_ENABLED
    }, personStore);
    this.mockEmitter = personStore
      ? new MockPushEmitter({
          assignments: this.assignments,
          pushAuth: this.pushAuth,
          personStore,
          ingest: (event) => this.ingestEvent(event),
          logger,
          burstIntervalMs: env.MOCK_EVENT_BURST_INTERVAL_MS,
          intraEventIntervalMs: env.MOCK_EVENT_INTRA_INTERVAL_MS,
          burstMin: env.MOCK_EVENT_BURST_MIN,
          burstMax: env.MOCK_EVENT_BURST_MAX
        })
      : null;
    this.backfillService = new BackfillService(this.store, this.assignments, this.clientFactory, logger);
    this.identityFindService = new IdentityFindService(this.assignments, this.clientFactory, logger);
    this.deliveryService = new DeliveryService(this.store, this.dsClient, this.metrics, logger);
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;

    const lease = await registerWithRetry({
      env: this.env,
      dsClient: this.dsClient,
      logger: this.logger,
      isRunning: () => this.running
    });

    this.applyLease(lease);
    this.startHeartbeatLoop();
    this.startDeliveryLoop();
    this.startPurgeLoop();
    this.mockEmitter?.start();
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }
    this.running = false;
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.deliveryTimer) {
      clearInterval(this.deliveryTimer);
      this.deliveryTimer = null;
    }
    if (this.purgeTimer) {
      clearInterval(this.purgeTimer);
      this.purgeTimer = null;
    }
    this.mockEmitter?.stop();
  }

  async backfill(input: BackfillRequest): Promise<NormalizedEvent[]> {
    return this.backfillService.fetch(input);
  }

  async findIdentity(input: IdentityFindRequest): Promise<IdentityFindMatch[]> {
    return this.identityFindService.find(input);
  }

  async exportIdentityUsers(input: {
    deviceId: string;
    limit: number;
    offset: number;
    includeCards: boolean;
  }): Promise<IdentityExportUser[]> {
    return this.identityFindService.exportUsers(input);
  }

  ingestEvent(event: NormalizedEvent): void {
    this.store.upsertEvent(event, this.env.RETENTION_MS);
    this.metrics.markIngested();
  }

  markIgnoredEvent(): void {
    this.metrics.markIgnored();
  }

  markIngestFailure(): void {
    this.metrics.markFailure();
  }

  resolvePushAuth(username: string): PushAuthIdentity | null {
    return this.pushAuth.resolvePushAuth(username);
  }

  getDeviceSettings(deviceId: string): ReturnType<PushAuthRegistry["getDeviceSettings"]> {
    return this.pushAuth.getDeviceSettings(deviceId);
  }

  getAssignmentDirection(deviceId: string): DeviceDirection | null {
    const assignment = this.assignments.get(deviceId);
    return assignment?.direction ?? null;
  }

  getSnapshot(input?: { deviceIds?: string[] }): {
    adapterId: string | null;
    mode: "active" | "draining";
    heartbeatIntervalMs: number;
    batchLimit: number;
    counters: { ingestedEvents: number; ignoredEvents: number; ingestFailures: number };
    devices: Array<{
      deviceId: string;
      assigned: boolean;
      hasSettings: boolean;
      lastAckedEventId: string | null;
    }>;
  } {
    const snapshot = this.metrics.getSnapshot({
      adapterId: this.adapterId,
      mode: this.mode,
      heartbeatIntervalMs: this.heartbeatIntervalMs,
      batchLimit: this.batchLimit,
      assignments: this.assignments,
      store: this.store,
      deviceIds: input?.deviceIds
    });
    return {
      ...snapshot,
      devices: snapshot.devices.map((item) => ({
        ...item,
        hasSettings: this.getDeviceSettings(item.deviceId) !== null
      }))
    };
  }

  getPrometheusMetrics(): string {
    return this.metrics.toPrometheus(this.assignments, this.store);
  }

  private startHeartbeatLoop(): void {
    const run = async () => {
      if (!this.running) {
        return;
      }
      if (this.heartbeatBusy) {
        this.heartbeatTimer = setTimeout(() => {
          void run();
        }, this.heartbeatIntervalMs);
        return;
      }
      this.heartbeatBusy = true;
      try {
        if (!this.adapterId) {
          throw new Error("adapterId is not initialized");
        }
        const lease = await this.dsClient.heartbeat({ adapterId: this.adapterId });
        this.applyLease(lease);
      } catch (error) {
        if (shouldReRegister(error)) {
          await this.reRegister("heartbeat", error);
        }
        this.logger.error({ err: error }, "heartbeat failed");
      } finally {
        this.heartbeatBusy = false;
      }
      this.heartbeatTimer = setTimeout(() => {
        void run();
      }, this.heartbeatIntervalMs);
    };
    this.heartbeatTimer = setTimeout(() => {
      void run();
    }, this.heartbeatIntervalMs);
  }

  private startDeliveryLoop(): void {
    this.deliveryTimer = setInterval(() => {
      void this.deliverPending();
    }, this.env.DELIVERY_INTERVAL_MS);
  }

  private startPurgeLoop(): void {
    this.purgeTimer = setInterval(() => {
      const deleted = this.store.purgeExpired();
      if (deleted > 0) {
        this.logger.info({ deleted }, "expired events purged");
      }
    }, this.env.PURGE_INTERVAL_MS);
  }

  private async deliverPending(): Promise<void> {
    if (!this.running || this.deliveryBusy || !this.adapterId) {
      return;
    }
    this.deliveryBusy = true;
    try {
      await this.deliveryService.deliverPending(
        {
          running: this.running,
          adapterId: this.adapterId,
          batchLimit: this.batchLimit
        },
        {
          onNeedReRegister: async (error) => {
            await this.reRegister("ingest", error);
          }
        }
      );
    } finally {
      this.deliveryBusy = false;
    }
  }

  private applyLease(lease: AdapterLease): void {
    this.adapterId = lease.adapterId;
    this.mode = lease.mode;
    this.batchLimit = lease.batchLimit;
    this.heartbeatIntervalMs = lease.heartbeatIntervalMs;
    const diff = this.assignments.apply(lease.devices);

    for (const assignment of diff.current) {
      this.store.setLastAckedEventId(assignment.deviceId, assignment.lastAckedEventId);
    }
    const failures = this.pushAuth.rebuild(diff.current);
    for (const failure of failures) {
      this.logger.warn({ deviceId: failure.deviceId, err: failure.error }, "device settings parse failed");
    }
  }

  private async reRegister(source: "heartbeat" | "ingest", error: unknown): Promise<void> {
    if (!this.running) {
      return;
    }

    if (this.reRegisterPromise) {
      await this.reRegisterPromise;
      return;
    }

    this.reRegisterPromise = (async () => {
      this.logger.warn({ source, err: error }, "adapter lease is invalid, re-registering");
      const lease = await registerWithRetry({
        env: this.env,
        dsClient: this.dsClient,
        logger: this.logger,
        isRunning: () => this.running
      });
      this.applyLease(lease);
      this.logger.info(
        { source, adapterId: lease.adapterId, mode: lease.mode, deviceCount: lease.devices.length },
        "adapter re-registered"
      );
    })().finally(() => {
      this.reRegisterPromise = null;
    });

    await this.reRegisterPromise;
  }
}
