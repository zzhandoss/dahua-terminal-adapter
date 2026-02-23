import type { AccessCardRecord, AccessControlRecord, AccessUserRecord } from "../dahua/dahua-client.js";
import type { VendorDeviceClient } from "../vendor/vendor-device-client.js";
import { MockPersonStore } from "./person-store.js";

export type MockDahuaClientOptions = {
  identitySelector: string;
  personStore: MockPersonStore;
};

const ACCESS_USER_SELECTORS = [
  "accessUser.Condition.UserID",
  "accessUser.Condition.UserName",
  "accessUser.Condition.CitizenIDNo"
] as const;

const ACCESS_CARD_SELECTORS = [
  "accessCard.Condition.UserID",
  "accessCard.Condition.CardNo",
  "accessCard.Condition.CardName"
] as const;

export class MockDahuaClient implements VendorDeviceClient {
  constructor(private readonly options: MockDahuaClientOptions) {}

  async connect(): Promise<void> {
    return;
  }

  async close(): Promise<void> {
    return;
  }

  async findAccessUsers(input: {
    condition: Record<string, string>;
    limit: number;
    offset?: number;
  }): Promise<AccessUserRecord[]> {
    if (Object.keys(input.condition).length === 0) {
      return this.options.personStore.list({
        offset: input.offset ?? 0,
        limit: input.limit
      }).map((person) => ({
        UserID: person.userId,
        UserName: person.cardName,
        UserType: "0",
        CitizenIDNo: person.citizenIdNo
      }));
    }
    const criteria = resolveSearchCriteria(input.condition, ACCESS_USER_SELECTORS);
    if (!criteria) {
      return [];
    }
    const matched = this.options.personStore.search({
      selector: criteria.selector,
      value: criteria.value,
      limit: input.limit
    });
    return matched.map((person) => ({
      UserID: person.userId,
      UserName: person.cardName,
      CitizenIDNo: person.citizenIdNo
    }));
  }

  async findAccessCards(input: {
    condition: Record<string, string>;
    limit: number;
    offset?: number;
  }): Promise<AccessCardRecord[]> {
    if (Object.keys(input.condition).length === 0) {
      return this.options.personStore.list({
        offset: input.offset ?? 0,
        limit: input.limit
      }).map((person) => ({
        UserID: person.userId,
        CardNo: person.cardNo,
        CardName: person.cardName
      }));
    }
    const criteria = resolveSearchCriteria(input.condition, ACCESS_CARD_SELECTORS);
    if (!criteria) {
      return [];
    }
    const matched = this.options.personStore.search({
      selector: criteria.selector,
      value: criteria.value,
      limit: input.limit
    });
    return matched.map((person) => ({
      UserID: person.userId,
      CardNo: person.cardNo,
      CardName: person.cardName
    }));
  }

  async findAccessControlRecords(_input: {
    startTimeUtcSec: number;
    endTimeUtcSec: number;
    count: number;
  }): Promise<AccessControlRecord[]> {
    return [];
  }

  makeMockAccessControlData(nowMs: number): {
    recNo: number;
    utcSec: number;
    userId: string;
    cardNo: string;
    method: number;
    type: "Entry" | "Exit";
  } {
    const person = this.options.personStore.pickRandom(Math.random);
    return {
      recNo: Math.floor(nowMs / 1000),
      utcSec: Math.floor(nowMs / 1000),
      userId: person.userId,
      cardNo: person.cardNo,
      method: 1,
      type: "Entry"
    };
  }
}

function resolveSearchCriteria(
  condition: Record<string, string>,
  selectors: readonly string[]
): { selector: string; value: string } | null {
  for (const selector of selectors) {
    const field = selector.split(".").slice(2).join(".");
    const value = condition[field];
    if (value !== undefined && value !== "") {
      return {
        selector,
        value
      };
    }
  }
  return null;
}
