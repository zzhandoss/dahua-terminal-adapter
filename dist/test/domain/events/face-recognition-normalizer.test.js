import { describe, expect, it } from "vitest";
import { EventStrategyRegistry } from "../../../src/domain/events/event-strategy-registry.js";
import { EventNormalizationPipeline } from "../../../src/domain/events/event-normalization-pipeline.js";
import { FaceRecognitionStrategy } from "../../../src/domain/events/strategies/face-recognition-strategy.js";
function makeEvent() {
    return {
        code: "FaceRecognition",
        action: "Pulse",
        index: 1,
        rawText: "Events[0].EventBaseInfo.Code=FaceRecognition",
        parsed: {
            code: "FaceRecognition",
            action: "Pulse",
            index: 1,
            uid: "uid-root",
            candidates: [
                {
                    similarity: 98,
                    person: {
                        uid: "candidate-uid",
                        groupId: "1000",
                        name: "John",
                        certificateId: "990012345678"
                    }
                }
            ],
            raw: {}
        }
    };
}
describe("FaceRecognitionStrategy", () => {
    it("normalizes event with stable identity fields", () => {
        const pipeline = new EventNormalizationPipeline(new EventStrategyRegistry([new FaceRecognitionStrategy()]));
        const normalized = pipeline.normalize(makeEvent(), {
            deviceId: "dev-1",
            direction: "IN",
            occurredAt: 1700000000000
        });
        expect(normalized).not.toBeNull();
        expect(normalized?.deviceId).toBe("dev-1");
        expect(normalized?.direction).toBe("IN");
        expect(normalized?.terminalPersonId).toBe("candidate-uid");
        expect(normalized?.eventId.startsWith("facerecognition-")).toBe(true);
    });
});
