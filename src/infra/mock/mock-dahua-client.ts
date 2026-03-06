import type {
  AccessCardRecord,
  AccessCardWriteInput,
  AccessControlRecord,
  AccessFaceRecord,
  AccessFaceWriteInput,
  AccessUserRecord,
  AccessUserWriteInput
} from "../dahua/dahua-client.js";
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
    const people = Object.keys(input.condition).length === 0
      ? this.options.personStore.list({ offset: input.offset ?? 0, limit: input.limit })
      : this.findPeopleByCondition(input.condition, ACCESS_USER_SELECTORS, input.limit);

    return people.map((person) => ({
      UserID: person.userId,
      UserName: person.userName,
      UserType: person.userType ?? undefined,
      UserStatus: person.userStatus ?? undefined,
      Authority: person.authority ?? undefined,
      CitizenIDNo: person.citizenIdNo,
      ValidFrom: person.validFrom ?? undefined,
      ValidTo: person.validTo ?? undefined
    }));
  }

  async findAccessCards(input: {
    condition: Record<string, string>;
    limit: number;
    offset?: number;
  }): Promise<AccessCardRecord[]> {
    const people = Object.keys(input.condition).length === 0
      ? this.options.personStore.list({ offset: input.offset ?? 0, limit: input.limit })
      : this.findPeopleByCondition(input.condition, ACCESS_CARD_SELECTORS, input.limit);

    return people.map((person) => ({
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

  async createAccessUser(input: AccessUserWriteInput): Promise<void> {
    this.options.personStore.upsertUser({
      userId: input.userId,
      userName: input.userName ?? input.userId,
      userType: optionalString(input.userType),
      userStatus: optionalString(input.userStatus),
      authority: optionalString(input.authority),
      citizenIdNo: input.citizenIdNo,
      validFrom: input.validFrom,
      validTo: input.validTo
    });
  }

  async updateAccessUser(input: AccessUserWriteInput): Promise<void> {
    await this.createAccessUser(input);
  }

  async createAccessCard(input: AccessCardWriteInput): Promise<void> {
    this.options.personStore.upsertCard({
      userId: input.userId,
      cardNo: input.cardNo,
      cardName: input.cardName
    });
  }

  async updateAccessCard(input: AccessCardWriteInput): Promise<void> {
    await this.createAccessCard(input);
  }

  async findAccessFaces(input: { userIds: string[] }): Promise<AccessFaceRecord[]> {
    return input.userIds
      .map((userId) => this.options.personStore.getByUserId(userId))
      .filter((person): person is NonNullable<typeof person> => person !== null)
      .map((person) => ({
        UserID: person.userId,
        PhotoData: person.photosBase64,
        PhotoURL: person.photoUrls
      }));
  }

  async createAccessFace(input: AccessFaceWriteInput): Promise<void> {
    this.options.personStore.upsertFace({
      userId: input.userId,
      photosBase64: input.photoData,
      photoUrls: input.photoUrl
    });
  }

  async updateAccessFace(input: AccessFaceWriteInput): Promise<void> {
    await this.createAccessFace(input);
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

  private findPeopleByCondition(
    condition: Record<string, string>,
    selectors: readonly string[],
    limit: number
  ) {
    const criteria = resolveSearchCriteria(condition, selectors);
    if (!criteria) {
      return [];
    }
    return this.options.personStore.search({
      selector: criteria.selector,
      value: criteria.value,
      limit
    });
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
      return { selector, value };
    }
  }
  return null;
}

function optionalString(value: number | string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return String(value);
}
