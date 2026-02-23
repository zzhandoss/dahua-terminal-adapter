import type { NormalizedEvent } from "../../contracts/device-service.js";
import type { DeviceDirection } from "../../contracts/device-service.js";
import type { RawDahuaEvent } from "../../infra/dahua/dahua-client.js";
import { EventStrategyRegistry } from "./event-strategy-registry.js";

export class EventNormalizationPipeline {
  constructor(private readonly registry: EventStrategyRegistry) {}

  normalize(
    rawEvent: RawDahuaEvent,
    context: { deviceId: string; direction: DeviceDirection; occurredAt: number }
  ): NormalizedEvent | null {
    const strategy = this.registry.resolve(rawEvent);
    if (!strategy) {
      return null;
    }
    return strategy.normalize(rawEvent, context);
  }
}
