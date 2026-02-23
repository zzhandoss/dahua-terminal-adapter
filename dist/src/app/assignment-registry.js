export class AssignmentRegistry {
    assignments = new Map();
    apply(nextAssignments) {
        const nextMap = new Map(nextAssignments.map((item) => [item.deviceId, item]));
        const added = [];
        const updated = [];
        const removed = [];
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
    get(deviceId) {
        return this.assignments.get(deviceId) ?? null;
    }
    all() {
        return [...this.assignments.values()];
    }
}
function sameAssignment(left, right) {
    return (left.deviceId === right.deviceId &&
        left.direction === right.direction &&
        left.settingsJson === right.settingsJson &&
        left.lastAckedEventId === right.lastAckedEventId);
}
