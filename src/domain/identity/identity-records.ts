import type { IdentityExportUser } from "../../contracts/device-service.js";

type RecordLike = Record<string, unknown>;

export function toExportUserKey(input: {
  deviceId: string;
  terminalPersonId: string | null;
  cardNo: string | null;
}): string {
  return `${input.deviceId}:${input.terminalPersonId ?? `card:${input.cardNo ?? ""}`}`;
}

export function readOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

export function toBaseExportUser(deviceId: string, record: RecordLike): IdentityExportUser {
  return {
    deviceId,
    terminalPersonId: readOptionalString(record.UserID),
    displayName: readOptionalString(record.UserName) ?? readOptionalString(record.Name),
    userType: readOptionalString(record.UserType),
    userStatus: readOptionalString(record.UserStatus),
    authority: readOptionalString(record.Authority),
    citizenIdNo: readOptionalString(record.CitizenIDNo),
    validFrom: readOptionalString(record.ValidFrom),
    validTo: readOptionalString(record.ValidTo),
    cardNo: null,
    cardName: null,
    sourceSummary: ["accessUser"],
    rawUserPayload: JSON.stringify(record),
    rawCardPayload: null
  };
}

export function mergeCardIntoExportUser(user: IdentityExportUser, card: RecordLike): IdentityExportUser {
  const sourceSummary: Array<"accessUser" | "accessCard"> = user.sourceSummary.includes("accessCard")
    ? user.sourceSummary
    : [...user.sourceSummary, "accessCard"];
  return {
    ...user,
    cardNo: readOptionalString(card.CardNo) ?? user.cardNo,
    cardName: readOptionalString(card.CardName) ?? user.cardName,
    displayName: user.displayName ?? readOptionalString(card.CardName),
    sourceSummary,
    rawCardPayload: JSON.stringify(card)
  };
}

export function toCardOnlyExportUser(deviceId: string, card: RecordLike): IdentityExportUser {
  return {
    deviceId,
    terminalPersonId: readOptionalString(card.UserID),
    displayName: readOptionalString(card.CardName),
    userType: null,
    userStatus: null,
    authority: null,
    citizenIdNo: null,
    validFrom: null,
    validTo: null,
    cardNo: readOptionalString(card.CardNo),
    cardName: readOptionalString(card.CardName),
    sourceSummary: ["accessCard"],
    rawUserPayload: null,
    rawCardPayload: JSON.stringify(card)
  };
}
