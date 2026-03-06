import type { Logger } from "pino";
import type {
  AdapterAssignment,
  IdentityUserPhotoGetRequest,
  IdentityUserPhotoRecord
} from "../../contracts/device-service.js";
import type { DahuaClientFactory } from "../../app/dahua-client-factory.js";
import type { AccessFaceRecord } from "../../infra/dahua/dahua-client.js";
import { IdentityFindError } from "../identity-find/identity-find-service.js";

export type AssignmentProvider = {
  get(deviceId: string): AdapterAssignment | null;
};

export class IdentityPhotoService {
  constructor(
    private readonly assignments: AssignmentProvider,
    private readonly clientFactory: DahuaClientFactory,
    private readonly logger: Logger
  ) {}

  async getPhoto(input: IdentityUserPhotoGetRequest): Promise<IdentityUserPhotoRecord> {
    const assignment = this.assignments.get(input.target.deviceId);
    if (!assignment) {
      throw new IdentityFindError("device assignment not found", 404);
    }

    const context = this.clientFactory.create(assignment);
    try {
      await context.client.connect();
      const faces = await context.client.findAccessFaces({
        userIds: [input.userId]
      });
      const face = findFaceRecord(faces, input.userId);
      if (!face) {
        throw new IdentityFindError("user face photo not found", 404);
      }

      return {
        deviceId: assignment.deviceId,
        userId: input.userId,
        photoData: toOptionalArray(face.PhotoData),
        photoUrl: toOptionalArray(face.PhotoURL),
        faceData: toOptionalArray(face.FaceData)
      };
    } catch (error) {
      if (error instanceof IdentityFindError) {
        throw error;
      }
      this.logger.error(
        { err: error, deviceId: assignment.deviceId, userId: input.userId },
        "identity photo lookup failed"
      );
      throw new IdentityFindError("vendor identity photo lookup failed", 502);
    } finally {
      await context.client.close().catch(() => undefined);
    }
  }
}

function findFaceRecord(records: AccessFaceRecord[], userId: string): AccessFaceRecord | null {
  for (const record of records) {
    if (record.UserID === userId) {
      return record;
    }
  }
  return null;
}

function toOptionalArray(value: string[] | undefined): string[] | null {
  if (!value || value.length === 0) {
    return null;
  }
  return value;
}
