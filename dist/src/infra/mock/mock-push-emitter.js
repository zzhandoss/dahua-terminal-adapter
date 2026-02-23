import { normalizeAccessControlEvent } from "../../domain/events/access-control-ingest.js";
export class MockPushEmitter {
    deps;
    timer = null;
    running = false;
    recNoByDevice = new Map();
    constructor(deps) {
        this.deps = deps;
    }
    start() {
        if (this.running) {
            return;
        }
        this.running = true;
        this.scheduleNext(10);
    }
    stop() {
        this.running = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    scheduleNext(delayMs) {
        this.timer = setTimeout(() => {
            void this.runCycle();
        }, delayMs);
    }
    async runCycle() {
        if (!this.running) {
            return;
        }
        const assignments = this.deps.assignments.all();
        await Promise.all(assignments.map(async (assignment) => {
            const settings = this.deps.pushAuth.getDeviceSettings(assignment.deviceId);
            if (!settings || settings.mockEnabled === false) {
                return;
            }
            const burst = this.randomBurstSize();
            for (let i = 0; i < burst; i += 1) {
                if (!this.running) {
                    return;
                }
                const event = this.makeEvent(assignment.deviceId, i % 2 === 0 ? "Entry" : "Exit");
                const normalized = normalizeAccessControlEvent({
                    deviceId: assignment.deviceId,
                    direction: assignment.direction,
                    event,
                    timePolicy: settings.timePolicy
                });
                if (normalized) {
                    this.deps.ingest(normalized);
                }
                if (i < burst - 1) {
                    await sleep(this.deps.intraEventIntervalMs);
                }
            }
        }));
        this.scheduleNext(this.deps.burstIntervalMs);
    }
    randomBurstSize() {
        const min = Math.min(this.deps.burstMin, this.deps.burstMax);
        const max = Math.max(this.deps.burstMin, this.deps.burstMax);
        return min + Math.floor(Math.random() * (max - min + 1));
    }
    makeEvent(deviceId, type) {
        const nowMs = Date.now();
        const current = (this.recNoByDevice.get(deviceId) ?? Math.floor(nowMs / 1000)) + 1;
        this.recNoByDevice.set(deviceId, current);
        const person = this.deps.personStore.pickRandom(Math.random);
        return {
            Code: "AccessControl",
            Action: "Pulse",
            Index: 0,
            Data: {
                RecNo: current,
                UTC: Math.floor(nowMs / 1000),
                Time: new Date(nowMs).toISOString().replace("T", " ").replace("Z", ""),
                UserID: person.userId,
                CardNo: person.cardNo,
                Type: type,
                Method: 1,
                Status: 1
            }
        };
    }
}
async function sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
