import type { AdapterAssignment, IdentityTarget } from "../../contracts/device-service.js";

export type AssignmentProvider = {
  get(deviceId: string): AdapterAssignment | null;
  all(): AdapterAssignment[];
};

export type ResolvedIdentityTargets = {
  assignments: AdapterAssignment[];
  missingDeviceIds: string[];
};

export function resolveIdentityTargets(
  assignments: AssignmentProvider,
  target: IdentityTarget
): ResolvedIdentityTargets {
  if (target.mode === "allAssigned") {
    return {
      assignments: assignments.all(),
      missingDeviceIds: []
    };
  }

  if (target.mode === "device") {
    const assignment = assignments.get(target.deviceId);
    return {
      assignments: assignment ? [assignment] : [],
      missingDeviceIds: assignment ? [] : [target.deviceId]
    };
  }

  const resolved: AdapterAssignment[] = [];
  const missingDeviceIds: string[] = [];
  for (const deviceId of target.deviceIds) {
    const assignment = assignments.get(deviceId);
    if (!assignment) {
      missingDeviceIds.push(deviceId);
      continue;
    }
    resolved.push(assignment);
  }
  return { assignments: resolved, missingDeviceIds };
}
