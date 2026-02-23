export type DeviceDirection = "IN" | "OUT";

export type AdapterAssignment = {
  deviceId: string;
  direction: DeviceDirection;
  settingsJson: string | null;
  lastAckedEventId: string | null;
};

export type AdapterMode = "active" | "draining";

export type AdapterRegisterInput = {
  vendorKey: string;
  instanceKey: string;
  instanceName: string;
  version: string;
  capabilities: string[];
  baseUrl: string;
  retentionMs: number;
  deviceSettingsSchema?: Record<string, unknown>;
  deviceSettingsSchemaVersion?: string;
};

export type AdapterHeartbeatInput = {
  adapterId: string;
};

export type AdapterLease = {
  adapterId: string;
  instanceKey: string;
  instanceName: string;
  mode: AdapterMode;
  heartbeatIntervalMs: number;
  batchLimit: number;
  devices: AdapterAssignment[];
};

export type NormalizedEvent = {
  eventId: string;
  deviceId: string;
  direction: DeviceDirection;
  occurredAt: number;
  terminalPersonId: string | null;
  rawPayload: string | null;
};

export type AdapterEventsInput = {
  adapterId: string;
  events: NormalizedEvent[];
};

export type RecordDeviceAccessEventResult = {
  result: "inserted" | "duplicate";
  deviceEventId: string | null;
};

export type AdapterEventsResult = {
  eventId: string;
  result: RecordDeviceAccessEventResult["result"];
  deviceEventId: string | null;
};

export type AdapterIngestResponse = {
  results: AdapterEventsResult[];
};

export type BackfillRequest = {
  deviceId: string;
  sinceEventId: string | null;
  limit: number;
};

export type BackfillResponse = {
  events: NormalizedEvent[];
};

export type IdentityFindRequest = {
  deviceId: string;
  identityKey: string;
  identityValue: string;
  limit: number;
};

export type IdentityFindMatch = {
  terminalPersonId: string | null;
  score: number | null;
  rawPayload: string | null;
  displayName?: string | null;
  source?: "accessUser" | "accessCard";
  userType?: string | null;
};

export type IdentityFindResponse = {
  matches: IdentityFindMatch[];
};

export type IdentityExportUsersRequest = {
  deviceId: string;
  limit: number;
  offset: number;
  includeCards: boolean;
};

export type IdentityExportUser = {
  terminalPersonId: string | null;
  displayName: string | null;
  userType: string | null;
  cardNo: string | null;
  source: "accessUser" | "accessCard";
  rawPayload: string | null;
};

export type IdentityExportUsersResponse = {
  users: IdentityExportUser[];
};
