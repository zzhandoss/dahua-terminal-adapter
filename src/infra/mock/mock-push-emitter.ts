import type { Logger } from "pino";
import type { AssignmentRegistry } from "../../app/assignment-registry.js";
import type { MockPersonStore } from "./person-store.js";
import { normalizeAccessControlEvent } from "../../domain/events/access-control-ingest.js";
import type { PushAuthRegistry } from "../../app/push-auth-registry.js";
import type { NormalizedEvent } from "../../contracts/device-service.js";

export class MockPushEmitter {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly recNoByDevice = new Map<string, number>();

  constructor(
    private readonly deps: {
      assignments: AssignmentRegistry;
      pushAuth: PushAuthRegistry;
      personStore: MockPersonStore;
      ingest: (event: NormalizedEvent) => void;
      logger: Logger;
      burstIntervalMs: number;
      intraEventIntervalMs: number;
      burstMin: number;
      burstMax: number;
    }
  ) {}

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.scheduleNext(10);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(delayMs: number): void {
    this.timer = setTimeout(() => {
      void this.runCycle();
    }, delayMs);
  }

  private async runCycle(): Promise<void> {
    if (!this.running) {
      return;
    }
    const assignments = this.deps.assignments.all();
    await Promise.all(assignments.map(async (assignment) => {
      const settings = this.deps.pushAuth.getDeviceSettings(assignment.deviceId);
      if (!settings || settings.mockEnabled === false) {
        return;
      }
      const burst = this.randomBurstSize();
      for (let i = 0; i < burst; i += 1) {
        if (!this.running) {
          return;
        }
        const event = this.makeEvent(assignment.deviceId, i % 2 === 0 ? "Entry" : "Exit");
        const normalized = normalizeAccessControlEvent({
          deviceId: assignment.deviceId,
          direction: assignment.direction,
          event,
          timePolicy: settings.timePolicy
        });
        if (normalized) {
          this.deps.ingest(normalized);
        }
        if (i < burst - 1) {
          await sleep(this.deps.intraEventIntervalMs);
        }
      }
    }));
    this.scheduleNext(this.deps.burstIntervalMs);
  }

  private randomBurstSize(): number {
    const min = Math.min(this.deps.burstMin, this.deps.burstMax);
    const max = Math.max(this.deps.burstMin, this.deps.burstMax);
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  private makeEvent(deviceId: string, type: "Entry" | "Exit"): {
    Code: string;
    Action: string;
    Index: number;
    Data: Record<string, unknown>;
  } {
    const nowMs = Date.now();
    const current = (this.recNoByDevice.get(deviceId) ?? Math.floor(nowMs / 1000)) + 1;
    this.recNoByDevice.set(deviceId, current);
    const person = this.deps.personStore.pickRandom(Math.random);
    return {
      Code: "AccessControl",
      Action: "Pulse",
      Index: 0,
      Data: {
        RecNo: current,
        UTC: Math.floor(nowMs / 1000),
        Time: new Date(nowMs).toISOString().replace("T", " ").replace("Z", ""),
        UserID: person.userId,
        CardNo: person.cardNo,
        Type: type,
        Method: 1,
        Status: 1
      }
    };
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}
