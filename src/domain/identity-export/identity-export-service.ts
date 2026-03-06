import type { Logger } from "pino";
import type {
  IdentityExportUser,
  IdentityExportUsersDeviceResult,
  IdentityExportUsersFlatResponse,
  IdentityExportUsersGroupedResponse,
  IdentityExportUsersRequest,
  IdentityExportUsersResponse
} from "../../contracts/device-service.js";
import type { DahuaClientFactory } from "../../app/dahua-client-factory.js";
import { IdentityFindError } from "../identity-find/identity-find-service.js";
import { resolveIdentityTargets, type AssignmentProvider } from "../identity/identity-target.js";
import {
  mergeCardIntoExportUser,
  toBaseExportUser,
  toCardOnlyExportUser,
  toExportUserKey
} from "../identity/identity-records.js";

export class IdentityExportService {
  constructor(
    private readonly assignments: AssignmentProvider,
    private readonly clientFactory: DahuaClientFactory,
    private readonly logger: Logger
  ) {}

  async exportUsers(input: IdentityExportUsersRequest): Promise<IdentityExportUsersResponse> {
    const resolved = resolveIdentityTargets(this.assignments, input.target);
    if (input.target.mode === "device" && resolved.assignments.length === 0) {
      throw new IdentityFindError("device assignment not found", 404);
    }

    const groupedDevices: Array<IdentityExportUsersDeviceResult & { users: IdentityExportUser[] }> = [];
    for (const assignment of resolved.assignments) {
      groupedDevices.push(await this.exportFromAssignment(assignment.deviceId, input));
    }
    for (const deviceId of resolved.missingDeviceIds) {
      groupedDevices.push({
        deviceId,
        users: [],
        exportedCount: 0,
        failed: true,
        errorCode: "device_not_found",
        errorMessage: "device assignment not found"
      });
    }

    if (input.view === "grouped") {
      const response: IdentityExportUsersGroupedResponse = {
        view: "grouped",
        devices: groupedDevices
      };
      return response;
    }

    const response: IdentityExportUsersFlatResponse = {
      view: "flat",
      users: groupedDevices.flatMap((item) => item.users),
      devices: groupedDevices.map(({ users, ...meta }) => meta)
    };
    return response;
  }

  private async exportFromAssignment(
    deviceId: string,
    input: IdentityExportUsersRequest
  ): Promise<IdentityExportUsersDeviceResult & { users: IdentityExportUser[] }> {
    const assignment = this.assignments.get(deviceId);
    if (!assignment) {
      return {
        deviceId,
        users: [],
        exportedCount: 0,
        failed: true,
        errorCode: "device_not_found",
        errorMessage: "device assignment not found"
      };
    }

    const context = this.clientFactory.create(assignment);
    try {
      await context.client.connect();
      const users = await context.client.findAccessUsers({
        condition: {},
        limit: input.limit,
        offset: input.offset
      });
      const cards = input.includeCards
        ? await context.client.findAccessCards({
            condition: {},
            limit: input.limit,
            offset: input.offset
          })
        : [];
      const normalized = mergeUsersAndCards(deviceId, users, cards);
      return {
        deviceId,
        users: normalized,
        exportedCount: normalized.length,
        failed: false,
        hasMore: users.length >= input.limit || cards.length >= input.limit
      };
    } catch (error) {
      this.logger.error({ err: error, deviceId }, "identity export failed");
      return {
        deviceId,
        users: [],
        exportedCount: 0,
        failed: true,
        errorCode: "identity_export_failed",
        errorMessage: error instanceof Error ? error.message : "unknown export error"
      };
    } finally {
      await context.client.close().catch(() => undefined);
    }
  }
}

function mergeUsersAndCards(
  deviceId: string,
  users: Record<string, unknown>[],
  cards: Record<string, unknown>[]
): IdentityExportUser[] {
  const merged = new Map<string, IdentityExportUser>();
  for (const user of users) {
    const normalized = toBaseExportUser(deviceId, user);
    merged.set(
      toExportUserKey({
        deviceId,
        terminalPersonId: normalized.terminalPersonId,
        cardNo: normalized.cardNo
      }),
      normalized
    );
  }
  for (const card of cards) {
    const key = toExportUserKey({
      deviceId,
      terminalPersonId: card.UserID === undefined ? null : String(card.UserID),
      cardNo: card.CardNo === undefined ? null : String(card.CardNo)
    });
    const existing = merged.get(key);
    if (existing) {
      merged.set(key, mergeCardIntoExportUser(existing, card));
      continue;
    }
    merged.set(key, toCardOnlyExportUser(deviceId, card));
  }
  return [...merged.values()];
}
