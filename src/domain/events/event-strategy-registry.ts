import type { RawDahuaEvent } from "../../infra/dahua/dahua-client.js";
import type { EventNormalizationStrategy } from "./strategies/strategy.js";

export class EventStrategyRegistry {
  constructor(private readonly strategies: EventNormalizationStrategy[]) {}

  resolve(event: RawDahuaEvent): EventNormalizationStrategy | null {
    for (const strategy of this.strategies) {
      if (strategy.supports(event)) {
        return strategy;
      }
    }
    return null;
  }
}
