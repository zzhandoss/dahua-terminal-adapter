import type { AssignmentRegistry } from "./assignment-registry.js";
import type { SqliteStore } from "../infra/store/sqlite-store.js";

export class RuntimeMetrics {
  private ingestedEvents = 0;
  private ignoredEvents = 0;
  private ingestFailures = 0;

  markIngested(): void {
    this.ingestedEvents += 1;
  }

  markIgnored(): void {
    this.ignoredEvents += 1;
  }

  markFailure(): void {
    this.ingestFailures += 1;
  }

  getSnapshot(input: {
    adapterId: string | null;
    mode: "active" | "draining";
    heartbeatIntervalMs: number;
    batchLimit: number;
    assignments: AssignmentRegistry;
    store: SqliteStore;
    deviceIds?: string[];
  }): {
    adapterId: string | null;
    mode: "active" | "draining";
    heartbeatIntervalMs: number;
    batchLimit: number;
    counters: { ingestedEvents: number; ignoredEvents: number; ingestFailures: number };
    devices: Array<{
      deviceId: string;
      assigned: boolean;
      lastAckedEventId: string | null;
    }>;
  } {
    const all = input.assignments.all();
    const selected = input.deviceIds && input.deviceIds.length > 0
      ? all.filter((item) => input.deviceIds?.includes(item.deviceId))
      : all;

    return {
      adapterId: input.adapterId,
      mode: input.mode,
      heartbeatIntervalMs: input.heartbeatIntervalMs,
      batchLimit: input.batchLimit,
      counters: {
        ingestedEvents: this.ingestedEvents,
        ignoredEvents: this.ignoredEvents,
        ingestFailures: this.ingestFailures
      },
      devices: selected.map((assignment) => ({
        deviceId: assignment.deviceId,
        assigned: true,
        lastAckedEventId: input.store.getLastAckedEventId(assignment.deviceId)
      }))
    };
  }

  toPrometheus(assignments: AssignmentRegistry, store: SqliteStore): string {
    const pending = store.listPending(1000000).length;
    const deviceCount = assignments.all().length;
    return [
      "# HELP dahua_adapter_ingested_events_total Total events accepted by ingest endpoints.",
      "# TYPE dahua_adapter_ingested_events_total counter",
      `dahua_adapter_ingested_events_total ${this.ingestedEvents}`,
      "# HELP dahua_adapter_ignored_events_total Total events ignored by filters.",
      "# TYPE dahua_adapter_ignored_events_total counter",
      `dahua_adapter_ignored_events_total ${this.ignoredEvents}`,
      "# HELP dahua_adapter_ingest_failures_total Total ingest parsing/auth failures.",
      "# TYPE dahua_adapter_ingest_failures_total counter",
      `dahua_adapter_ingest_failures_total ${this.ingestFailures}`,
      "# HELP dahua_adapter_pending_events Pending local events waiting for DS delivery.",
      "# TYPE dahua_adapter_pending_events gauge",
      `dahua_adapter_pending_events ${pending}`,
      "# HELP dahua_adapter_assigned_devices Currently assigned devices.",
      "# TYPE dahua_adapter_assigned_devices gauge",
      `dahua_adapter_assigned_devices ${deviceCount}`
    ].join("\n");
  }
}
