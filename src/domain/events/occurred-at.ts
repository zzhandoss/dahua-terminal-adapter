import type { RawDahuaEvent } from "../../infra/dahua/dahua-client.js";
import type { DahuaTimePolicy } from "../devices/device-settings.js";

const TIME_CANDIDATE_KEYS = [
  "Events[0].UTC",
  "Events[0].Time",
  "Events[0].EventBaseInfo.UTC",
  "Events[0].EventBaseInfo.Time"
];

export function resolveOccurredAt(event: RawDahuaEvent, now = Date.now()): number {
  return resolveOccurredAtWithPolicy(event, { mode: "boundedDevice", maxDriftMs: 60000 }, now).occurredAt;
}

export function resolveOccurredAtWithPolicy(
  event: RawDahuaEvent,
  policy: DahuaTimePolicy,
  now = Date.now()
): { occurredAt: number; usedFallback: boolean; driftMs: number | null } {
  if (policy.mode === "adapter") {
    return { occurredAt: now, usedFallback: true, driftMs: null };
  }

  for (const key of TIME_CANDIDATE_KEYS) {
    const raw = event.raw[key];
    if (!raw) {
      continue;
    }
    const parsed = Date.parse(raw.replace(" ", "T"));
    if (Number.isFinite(parsed)) {
      if (policy.mode === "device") {
        return { occurredAt: parsed, usedFallback: false, driftMs: parsed - now };
      }
      const driftMs = parsed - now;
      if (Math.abs(driftMs) <= policy.maxDriftMs) {
        return { occurredAt: parsed, usedFallback: false, driftMs };
      }
      return { occurredAt: now, usedFallback: true, driftMs };
    }
  }
  return { occurredAt: now, usedFallback: true, driftMs: null };
}

export function resolveOccurredAtFromAccessEvent(
  event: RawDahuaEvent,
  policy: DahuaTimePolicy,
  now = Date.now()
): number {
  if (policy.mode === "adapter") {
    return now;
  }

  const utcRaw = readDataField(event, "UTC");
  if (utcRaw) {
    const utcSec = Number.parseInt(utcRaw, 10);
    if (!Number.isNaN(utcSec)) {
      const eventMs = utcSec * 1000;
      if (policy.mode === "device") {
        return eventMs;
      }
      if (Math.abs(eventMs - now) <= policy.maxDriftMs) {
        return eventMs;
      }
      return now;
    }
  }

  const timeRaw = readDataField(event, "Time");
  if (timeRaw) {
    const parsed = Date.parse(timeRaw.replace(" ", "T"));
    if (Number.isFinite(parsed)) {
      if (policy.mode === "device") {
        return parsed;
      }
      if (Math.abs(parsed - now) <= policy.maxDriftMs) {
        return parsed;
      }
      return now;
    }
  }

  return now;
}

function readDataField(event: RawDahuaEvent, key: string): string | null {
  const value = event.data[key];
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}
