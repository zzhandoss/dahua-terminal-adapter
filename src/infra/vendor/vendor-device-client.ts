import type {
  AccessCardRecord,
  AccessControlRecord,
  AccessFaceRecord,
  AccessFaceWriteInput,
  AccessUserRecord,
  AccessUserWriteInput,
  AccessCardWriteInput
} from "../dahua/dahua-client.js";

export type VendorDeviceClient = {
  connect(): Promise<void>;
  close(): Promise<void>;
  findAccessUsers(input: {
    condition: Record<string, string>;
    limit: number;
    offset?: number;
  }): Promise<AccessUserRecord[]>;
  findAccessCards(input: {
    condition: Record<string, string>;
    limit: number;
    offset?: number;
  }): Promise<AccessCardRecord[]>;
  findAccessControlRecords(input: {
    startTimeUtcSec: number;
    endTimeUtcSec: number;
    count: number;
  }): Promise<AccessControlRecord[]>;
  createAccessUser(input: AccessUserWriteInput): Promise<void>;
  updateAccessUser(input: AccessUserWriteInput): Promise<void>;
  createAccessCard(input: AccessCardWriteInput): Promise<void>;
  updateAccessCard(input: AccessCardWriteInput): Promise<void>;
  findAccessFaces(input: { userIds: string[] }): Promise<AccessFaceRecord[]>;
  createAccessFace(input: AccessFaceWriteInput): Promise<void>;
  updateAccessFace(input: AccessFaceWriteInput): Promise<void>;
};
