import type { AdapterAssignment } from "../contracts/device-service.js";

export type AssignmentDiff = {
  added: AdapterAssignment[];
  updated: AdapterAssignment[];
  removed: AdapterAssignment[];
  current: AdapterAssignment[];
};

export class AssignmentRegistry {
  private readonly assignments = new Map<string, AdapterAssignment>();

  apply(nextAssignments: AdapterAssignment[]): AssignmentDiff {
    const nextMap = new Map(nextAssignments.map((item) => [item.deviceId, item]));
    const added: AdapterAssignment[] = [];
    const updated: AdapterAssignment[] = [];
    const removed: AdapterAssignment[] = [];

    for (const [deviceId, next] of nextMap) {
      const prev = this.assignments.get(deviceId);
      if (!prev) {
        added.push(next);
        continue;
      }
      if (!sameAssignment(prev, next)) {
        updated.push(next);
      }
    }

    for (const [deviceId, prev] of this.assignments) {
      if (!nextMap.has(deviceId)) {
        removed.push(prev);
      }
    }

    this.assignments.clear();
    for (const next of nextAssignments) {
      this.assignments.set(next.deviceId, next);
    }

    return {
      added,
      updated,
      removed,
      current: [...this.assignments.values()]
    };
  }

  get(deviceId: string): AdapterAssignment | null {
    return this.assignments.get(deviceId) ?? null;
  }

  all(): AdapterAssignment[] {
    return [...this.assignments.values()];
  }
}

function sameAssignment(left: AdapterAssignment, right: AdapterAssignment): boolean {
  return (
    left.deviceId === right.deviceId &&
    left.direction === right.direction &&
    left.settingsJson === right.settingsJson &&
    left.lastAckedEventId === right.lastAckedEventId
  );
}
