import type { NormalizedEvent } from "../../../contracts/device-service.js";
import type { DeviceDirection } from "../../../contracts/device-service.js";
import type { RawDahuaEvent } from "../../../infra/dahua/dahua-client.js";

export type NormalizeContext = {
  deviceId: string;
  direction: DeviceDirection;
  occurredAt: number;
};

export interface EventNormalizationStrategy {
  supports(event: RawDahuaEvent): boolean;
  normalize(event: RawDahuaEvent, context: NormalizeContext): NormalizedEvent | null;
}
