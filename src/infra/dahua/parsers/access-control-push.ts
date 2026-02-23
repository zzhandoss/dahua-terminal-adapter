import type { RawDahuaEvent } from "../dahua-client.js";
import {
  toIntOrNull,
  toObjectOrNull,
  toStringOrNull
} from "../../../shared/parse.js";

export type EventUploadBody = {
  Code: string;
  Action: string;
  Index: number;
  Data: Record<string, unknown>;
};

export type ImageEventUploadBody = {
  Channel: number;
  Time?: string;
  Events: EventUploadBody[];
};

export function parseEventUploadBody(input: unknown): EventUploadBody | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const body = input as Record<string, unknown>;
  const code = toStringOrNull(body.Code);
  const action = toStringOrNull(body.Action) ?? "Pulse";
  const index = toIntOrNull(body.Index) ?? 0;
  const data = toObjectOrNull(body.Data);
  if (!code || !data) {
    return null;
  }
  return { Code: code, Action: action ?? "Pulse", Index: index, Data: data };
}

export function parseImageEventUploadBody(input: unknown): ImageEventUploadBody | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const body = input as Record<string, unknown>;
  const channel = toIntOrNull(body.Channel) ?? 0;
  const time = toStringOrNull(body.Time) ?? toStringOrNull(body.TIme);
  const eventsRaw = body.Events;
  if (!Array.isArray(eventsRaw)) {
    return null;
  }
  const events = eventsRaw
    .map((item) => parseEventUploadBody(item))
    .filter((item): item is EventUploadBody => item !== null);
  if (events.length === 0) {
    return null;
  }
  return { Channel: channel, Time: time ?? undefined, Events: events };
}

export function parseTextPlainUploadEvent(input: string): EventUploadBody | null {
  const raw = input.trim();
  if (!raw || raw.toLowerCase() === "heartbeat") {
    return null;
  }

  const code = readField(raw, "Code");
  const action = readField(raw, "action") ?? readField(raw, "Action") ?? "Pulse";
  const indexRaw = readField(raw, "index") ?? readField(raw, "Index") ?? "0";
  const dataRaw = readFieldFromTail(raw, "data") ?? readFieldFromTail(raw, "Data");
  if (!code || !dataRaw) {
    return null;
  }

  let data: unknown;
  try {
    data = JSON.parse(dataRaw);
  } catch {
    return null;
  }

  const dataObject = toObjectOrNull(data);
  if (!dataObject) {
    return null;
  }
  const index = toIntOrNull(indexRaw) ?? 0;
  return {
    Code: code,
    Action: action,
    Index: index,
    Data: dataObject
  };
}

export function parseTextPlainUploadToJson(input: string): Record<string, unknown> {
  const raw = input.trim();
  if (!raw) {
    return { raw: "", kind: "empty" };
  }
  if (raw.toLowerCase() === "heartbeat") {
    return { raw, kind: "heartbeat" };
  }
  if ((raw.startsWith("{") && raw.endsWith("}")) || (raw.startsWith("[") && raw.endsWith("]"))) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          kind: "json",
          raw,
          ...(parsed as Record<string, unknown>)
        };
      }
      return { kind: "json", raw, value: parsed };
    } catch {
      return { kind: "json-invalid", raw };
    }
  }

  const tokens = splitBySemicolon(raw);
  const out: Record<string, unknown> = { raw, kind: "kv-semi" };
  for (const token of tokens) {
    const eq = token.indexOf("=");
    if (eq < 0) {
      continue;
    }
    const key = token.slice(0, eq).trim();
    const valueRaw = token.slice(eq + 1).trim();
    if (!key) {
      continue;
    }
    out[key] = parseMaybeJson(valueRaw);
  }
  return out;
}

export function toRawDahuaEvent(event: EventUploadBody): RawDahuaEvent {
  return {
    code: event.Code,
    action: event.Action,
    index: event.Index,
    rawText: JSON.stringify({
      Code: event.Code,
      Action: event.Action,
      Index: event.Index,
      Data: event.Data
    }),
    raw: flattenObject(event.Data),
    data: event.Data
  };
}

function flattenObject(
  value: Record<string, unknown>,
  prefix = "",
  out: Record<string, string> = {}
): Record<string, string> {
  for (const [key, nested] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(nested)) {
      nested.forEach((item, index) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          flattenObject(item as Record<string, unknown>, `${next}[${index}]`, out);
        } else {
          out[`${next}[${index}]`] = String(item ?? "");
        }
      });
      continue;
    }
    if (nested && typeof nested === "object") {
      flattenObject(nested as Record<string, unknown>, next, out);
      continue;
    }
    out[next] = String(nested ?? "");
  }
  return out;
}


function readField(input: string, key: string): string | null {
  const pattern = new RegExp(`(?:^|;)\\s*${escapeRegExp(key)}=([^;]*)`, "i");
  const match = input.match(pattern);
  if (!match) {
    return null;
  }
  return match[1]?.trim() ?? null;
}

function readFieldFromTail(input: string, key: string): string | null {
  const pattern = new RegExp(`(?:^|;)\\s*${escapeRegExp(key)}=`, "ig");
  const matches = [...input.matchAll(pattern)];
  if (matches.length === 0) {
    return null;
  }
  const last = matches[matches.length - 1];
  const start = (last?.index ?? -1) + String(last?.[0] ?? "").length;
  if (start < 0 || start > input.length) {
    return null;
  }
  return input.slice(start).trim();
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitBySemicolon(input: string): string[] {
  const out: string[] = [];
  let cur = "";
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i] ?? "";
    if (quote) {
      cur += ch;
      if (ch === quote && input[i - 1] !== "\\") {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch as '"' | "'";
      cur += ch;
      continue;
    }
    if (ch === "{") {
      depth += 1;
      cur += ch;
      continue;
    }
    if (ch === "}") {
      depth = Math.max(0, depth - 1);
      cur += ch;
      continue;
    }
    if (ch === ";" && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur) {
    out.push(cur);
  }
  return out;
}

function parseMaybeJson(valueRaw: string): unknown {
  const trimmed = valueRaw.trim();
  if (!trimmed) {
    return "";
  }
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  if (/^-?\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  return trimmed;
}
