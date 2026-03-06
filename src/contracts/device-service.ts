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

export type IdentityTarget =
  | { mode: "device"; deviceId: string }
  | { mode: "devices"; deviceIds: string[] }
  | { mode: "allAssigned" };

export type IdentityExportView = "flat" | "grouped";

export type IdentityExportUsersRequest = {
  target: IdentityTarget;
  limit: number;
  offset: number;
  includeCards: boolean;
  view: IdentityExportView;
};

export type IdentityExportUser = {
  deviceId: string;
  terminalPersonId: string | null;
  displayName: string | null;
  userType: string | null;
  userStatus: string | null;
  authority: string | null;
  citizenIdNo: string | null;
  validFrom: string | null;
  validTo: string | null;
  cardNo: string | null;
  cardName: string | null;
  sourceSummary: Array<"accessUser" | "accessCard">;
  rawUserPayload: string | null;
  rawCardPayload: string | null;
};

export type IdentityExportUsersDeviceResult = {
  deviceId: string;
  exportedCount: number;
  failed: boolean;
  errorCode?: string;
  errorMessage?: string;
  hasMore?: boolean;
};

export type IdentityExportUsersFlatResponse = {
  view: "flat";
  users: IdentityExportUser[];
  devices: IdentityExportUsersDeviceResult[];
};

export type IdentityExportUsersGroupedResponse = {
  view: "grouped";
  devices: Array<IdentityExportUsersDeviceResult & { users: IdentityExportUser[] }>;
};

export type IdentityExportUsersResponse =
  | IdentityExportUsersFlatResponse
  | IdentityExportUsersGroupedResponse;

export type IdentityWriteUserFaceInput = {
  photosBase64: string[] | null;
  photoUrls: string[] | null;
};

export type IdentityWriteUserCardInput = {
  cardNo: string;
  cardName: string | null;
  cardType: number | null;
  cardStatus: number | null;
};

export type IdentityWritePersonInput = {
  userId: string;
  displayName: string;
  userType: number | null;
  userStatus: number | null;
  authority: number | null;
  citizenIdNo: string | null;
  password: string | null;
  useTime: number | null;
  isFirstEnter: boolean | null;
  firstEnterDoors: number[] | null;
  doors: number[] | null;
  timeSections: number[] | null;
  specialDaysSchedule: number[] | null;
  validFrom: string | null;
  validTo: string | null;
  card: IdentityWriteUserCardInput | null;
  face: IdentityWriteUserFaceInput | null;
};

export type IdentityWriteUserRequest = {
  target: IdentityTarget;
  person: IdentityWritePersonInput;
};

export type IdentityWriteUserStepStatus = "success" | "failed" | "skipped";
export type IdentityWriteUserStatus = "success" | "failed" | "skipped";

export type IdentityWriteSteps = {
  accessUser: IdentityWriteUserStepStatus;
  accessCard: IdentityWriteUserStepStatus;
  accessFace: IdentityWriteUserStepStatus;
};

export type IdentityWriteUserDeviceResult = {
  deviceId: string;
  status: IdentityWriteUserStatus;
  operation: "create" | "update";
  steps: IdentityWriteSteps;
  errorCode?: string;
  errorMessage?: string;
};

export type IdentityWriteUserResponse = {
  results: IdentityWriteUserDeviceResult[];
};

export type IdentityBulkCreateUsersRequest = {
  target: IdentityTarget;
  persons: IdentityWritePersonInput[];
};

export type IdentityBulkCreateUserDeviceResult = {
  userId: string;
  deviceId: string;
  status: IdentityWriteUserStatus;
  operation: "create";
  steps: IdentityWriteSteps;
  skipCode?: "user_already_exists";
  skipMessage?: string;
  errorCode?: string;
  errorMessage?: string;
};

export type IdentityBulkCreateUsersResponse = {
  results: IdentityBulkCreateUserDeviceResult[];
};

export type IdentityUserPhotoGetRequest = {
  target: { mode: "device"; deviceId: string };
  userId: string;
};

export type IdentityUserPhotoRecord = {
  deviceId: string;
  userId: string;
  photoData: string[] | null;
  photoUrl: string[] | null;
  faceData: string[] | null;
};

export type IdentityUserPhotoGetResponse = {
  photo: IdentityUserPhotoRecord;
};
