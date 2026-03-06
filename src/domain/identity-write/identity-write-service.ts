import type { Logger } from "pino";
import type {
  IdentityBulkCreateUserDeviceResult,
  IdentityBulkCreateUsersRequest,
  IdentityWritePersonInput,
  IdentityWriteUserDeviceResult,
  IdentityWriteUserRequest
} from "../../contracts/device-service.js";
import type { DahuaClientFactory } from "../../app/dahua-client-factory.js";
import type { VendorDeviceClient } from "../../infra/vendor/vendor-device-client.js";
import { IdentityFindError } from "../identity-find/identity-find-service.js";
import { resolveIdentityTargets, type AssignmentProvider } from "../identity/identity-target.js";
import {
  makeAlreadyExistsBulkResult,
  makeBulkResult,
  makeMissingBulkDeviceResult,
  makeMissingDeviceResult,
  makeSkippedSteps,
  toAccessCardWriteInput,
  toAccessFaceWriteInput,
  toAccessUserWriteInput,
  validatePersonInput,
  validatePersonsInput,
  type WriteResultLike
} from "./identity-write-support.js";

export class IdentityWriteService {
  constructor(
    private readonly assignments: AssignmentProvider,
    private readonly clientFactory: DahuaClientFactory,
    private readonly logger: Logger
  ) {}

  async create(input: IdentityWriteUserRequest): Promise<IdentityWriteUserDeviceResult[]> {
    return this.write("create", input);
  }

  async update(input: IdentityWriteUserRequest): Promise<IdentityWriteUserDeviceResult[]> {
    return this.write("update", input);
  }

  async bulkCreate(input: IdentityBulkCreateUsersRequest): Promise<IdentityBulkCreateUserDeviceResult[]> {
    validatePersonsInput(input.persons);
    const resolved = resolveIdentityTargets(this.assignments, input.target);
    if (input.target.mode === "device" && resolved.assignments.length === 0) {
      throw new IdentityFindError("device assignment not found", 404);
    }

    const results: IdentityBulkCreateUserDeviceResult[] = [];
    for (const assignment of resolved.assignments) {
      results.push(...await this.bulkCreateToAssignment(assignment.deviceId, input.persons));
    }
    for (const deviceId of resolved.missingDeviceIds) {
      results.push(...input.persons.map((person) => makeMissingBulkDeviceResult(deviceId, person.userId)));
    }
    return results;
  }

  private async write(
    operation: "create" | "update",
    input: IdentityWriteUserRequest
  ): Promise<IdentityWriteUserDeviceResult[]> {
    validatePersonInput(input.person);
    const resolved = resolveIdentityTargets(this.assignments, input.target);
    if (input.target.mode === "device" && resolved.assignments.length === 0) {
      throw new IdentityFindError("device assignment not found", 404);
    }

    const results: IdentityWriteUserDeviceResult[] = [];
    for (const assignment of resolved.assignments) {
      results.push(await this.writeToAssignment(operation, assignment.deviceId, input.person));
    }
    for (const deviceId of resolved.missingDeviceIds) {
      results.push(makeMissingDeviceResult(deviceId, operation));
    }
    return results;
  }

  private async writeToAssignment(
    operation: "create" | "update",
    deviceId: string,
    person: IdentityWritePersonInput
  ): Promise<IdentityWriteUserDeviceResult> {
    const assignment = this.assignments.get(deviceId);
    if (!assignment) {
      return makeMissingDeviceResult(deviceId, operation);
    }

    const context = this.clientFactory.create(assignment);
    const result: IdentityWriteUserDeviceResult = {
      deviceId,
      operation,
      status: "success",
      steps: makeSkippedSteps()
    };

    try {
      await context.client.connect();
      await this.applyWrite(operation, context.client, result, person);
      return result;
    } catch (error) {
      this.markFailure(result, "accessUser", error);
      return result;
    } finally {
      await context.client.close().catch(() => undefined);
    }
  }

  private async bulkCreateToAssignment(
    deviceId: string,
    persons: IdentityWritePersonInput[]
  ): Promise<IdentityBulkCreateUserDeviceResult[]> {
    const assignment = this.assignments.get(deviceId);
    if (!assignment) {
      return persons.map((person) => makeMissingBulkDeviceResult(deviceId, person.userId));
    }

    const context = this.clientFactory.create(assignment);
    const results: IdentityBulkCreateUserDeviceResult[] = [];

    try {
      await context.client.connect();
      for (const person of persons) {
        results.push(await this.bulkCreateForPerson(deviceId, person, context.client));
      }
      return results;
    } finally {
      await context.client.close().catch(() => undefined);
    }
  }

  private async bulkCreateForPerson(
    deviceId: string,
    person: IdentityWritePersonInput,
    client: VendorDeviceClient
  ): Promise<IdentityBulkCreateUserDeviceResult> {
    const result = makeBulkResult(deviceId, person.userId);

    try {
      if (await this.userExists(client, person.userId)) {
        return makeAlreadyExistsBulkResult(deviceId, person.userId);
      }
      await this.applyWrite("create", client, result, person);
      return result;
    } catch (error) {
      this.markFailure(result, "accessUser", error);
      return result;
    }
  }

  private async userExists(client: VendorDeviceClient, userId: string): Promise<boolean> {
    const matches = await client.findAccessUsers({
      condition: { UserID: userId },
      limit: 1
    });
    return matches.length > 0;
  }

  private async applyWrite(
    operation: "create" | "update",
    client: VendorDeviceClient,
    result: WriteResultLike,
    person: IdentityWritePersonInput
  ): Promise<void> {
    const userInput = toAccessUserWriteInput(person);
    if (operation === "create") {
      await client.createAccessUser(userInput);
    } else {
      await client.updateAccessUser(userInput);
    }
    result.steps.accessUser = "success";

    if (person.card) {
      const cardInput = toAccessCardWriteInput(person);
      try {
        if (operation === "create") {
          await client.createAccessCard(cardInput);
        } else {
          await client.updateAccessCard(cardInput);
        }
        result.steps.accessCard = "success";
      } catch (error) {
        this.markFailure(result, "accessCard", error);
      }
    }

    if (person.face) {
      const faceInput = toAccessFaceWriteInput(person);
      try {
        if (operation === "create") {
          await client.createAccessFace(faceInput);
        } else {
          await this.upsertAccessFace(client, person.userId, faceInput);
        }
        result.steps.accessFace = "success";
      } catch (error) {
        this.markFailure(result, "accessFace", error);
      }
    }
  }

  private markFailure(
    result: WriteResultLike,
    step: "accessUser" | "accessCard" | "accessFace",
    error: unknown
  ): void {
    this.logger.error({ err: error, deviceId: result.deviceId, step }, "identity write failed");
    result.steps[step] = "failed";
    result.status = "failed";
    result.errorCode = "identity_write_failed";
    result.errorMessage = error instanceof Error ? error.message : "unknown identity write error";
  }

  private async upsertAccessFace(
    client: VendorDeviceClient,
    userId: string,
    faceInput: ReturnType<typeof toAccessFaceWriteInput>
  ): Promise<void> {
    const hasFace = await this.faceExists(client, userId);
    if (hasFace) {
      await client.updateAccessFace(faceInput);
      return;
    }
    await client.createAccessFace(faceInput);
  }

  private async faceExists(client: VendorDeviceClient, userId: string): Promise<boolean> {
    const faces = await client.findAccessFaces({ userIds: [userId] });
    return faces.some((face) => face.UserID === userId);
  }
}
