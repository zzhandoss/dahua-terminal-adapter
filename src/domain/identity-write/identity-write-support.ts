import type {
  IdentityBulkCreateUserDeviceResult,
  IdentityWritePersonInput,
  IdentityWriteSteps,
  IdentityWriteUserDeviceResult,
  IdentityWriteUserStatus
} from "../../contracts/device-service.js";
import type {
  AccessCardWriteInput,
  AccessFaceWriteInput,
  AccessUserWriteInput
} from "../../infra/dahua/dahua-client.js";
import { IdentityFindError } from "../identity-find/identity-find-service.js";

export type WriteResultLike = {
  deviceId: string;
  status: IdentityWriteUserStatus;
  steps: IdentityWriteSteps;
  errorCode?: string;
  errorMessage?: string;
};

export function validatePersonInput(person: IdentityWritePersonInput): void {
  if (!person.userId.trim()) {
    throw new IdentityFindError("person.userId is required", 422);
  }
  if (!person.displayName.trim()) {
    throw new IdentityFindError("person.displayName is required", 422);
  }
  if (person.card && !person.card.cardNo.trim()) {
    throw new IdentityFindError("person.card.cardNo is required", 422);
  }
  if (person.face) {
    const hasBase64 = Boolean(person.face.photosBase64?.length);
    const hasUrls = Boolean(person.face.photoUrls?.length);
    if (!hasBase64 && !hasUrls) {
      throw new IdentityFindError("person.face requires photosBase64 or photoUrls", 422);
    }
  }
}

export function validatePersonsInput(persons: IdentityWritePersonInput[]): void {
  if (persons.length === 0) {
    throw new IdentityFindError("persons must not be empty", 422);
  }
  for (const person of persons) {
    validatePersonInput(person);
  }
}

export function toAccessUserWriteInput(person: IdentityWritePersonInput): AccessUserWriteInput {
  return {
    userId: person.userId,
    userName: person.displayName,
    userType: person.userType ?? undefined,
    useTime: person.useTime ?? undefined,
    isFirstEnter: person.isFirstEnter ?? undefined,
    firstEnterDoors: person.firstEnterDoors ?? undefined,
    userStatus: person.userStatus ?? undefined,
    authority: person.authority ?? undefined,
    citizenIdNo: person.citizenIdNo ?? undefined,
    password: person.password ?? undefined,
    doors: person.doors ?? undefined,
    timeSections: person.timeSections ?? undefined,
    specialDaysSchedule: person.specialDaysSchedule ?? undefined,
    validFrom: person.validFrom ?? undefined,
    validTo: person.validTo ?? undefined
  };
}

export function toAccessCardWriteInput(person: IdentityWritePersonInput): AccessCardWriteInput {
  if (!person.card) {
    throw new Error("person.card is required");
  }
  return {
    cardNo: person.card.cardNo,
    userId: person.userId,
    cardType: person.card.cardType ?? undefined,
    cardName: person.card.cardName ?? person.displayName,
    cardStatus: person.card.cardStatus ?? undefined
  };
}

export function toAccessFaceWriteInput(person: IdentityWritePersonInput): AccessFaceWriteInput {
  if (!person.face) {
    throw new Error("person.face is required");
  }
  const photoData = person.face.photosBase64?.filter((item) => item.trim().length > 0) ?? [];
  const photoUrl = photoData.length === 0
    ? person.face.photoUrls?.filter((item) => item.trim().length > 0) ?? []
    : [];
  return {
    userId: person.userId,
    photoData: photoData.length > 0 ? photoData : undefined,
    photoUrl: photoUrl.length > 0 ? photoUrl : undefined
  };
}

export function makeMissingDeviceResult(
  deviceId: string,
  operation: "create" | "update"
): IdentityWriteUserDeviceResult {
  return {
    deviceId,
    operation,
    status: "failed",
    steps: makeSkippedSteps(),
    errorCode: "device_not_found",
    errorMessage: "device assignment not found"
  };
}

export function makeBulkResult(
  deviceId: string,
  userId: string
): IdentityBulkCreateUserDeviceResult {
  return {
    userId,
    deviceId,
    operation: "create",
    status: "success",
    steps: makeSkippedSteps()
  };
}

export function makeMissingBulkDeviceResult(
  deviceId: string,
  userId: string
): IdentityBulkCreateUserDeviceResult {
  return {
    ...makeBulkResult(deviceId, userId),
    status: "failed",
    errorCode: "device_not_found",
    errorMessage: "device assignment not found"
  };
}

export function makeAlreadyExistsBulkResult(
  deviceId: string,
  userId: string
): IdentityBulkCreateUserDeviceResult {
  return {
    ...makeBulkResult(deviceId, userId),
    status: "skipped",
    skipCode: "user_already_exists",
    skipMessage: "user already exists on device"
  };
}

export function makeSkippedSteps(): IdentityWriteSteps {
  return {
    accessUser: "skipped",
    accessCard: "skipped",
    accessFace: "skipped"
  };
}
