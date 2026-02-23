import type { AccessCardRecord, AccessControlRecord, AccessUserRecord } from "../dahua/dahua-client.js";

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
};
