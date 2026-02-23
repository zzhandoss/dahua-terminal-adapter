import { buildStableEventId } from "../event-id.js";
export class FaceRecognitionStrategy {
    supports(event) {
        return event.code === "FaceRecognition";
    }
    normalize(event, context) {
        const primaryCandidate = event.parsed.candidates[0];
        const terminalPersonId = primaryCandidate?.person.uid ?? event.parsed.uid ?? null;
        const eventId = buildStableEventId({
            deviceId: context.deviceId,
            eventCode: event.code,
            occurredAt: context.occurredAt,
            uid: event.parsed.uid,
            index: event.index,
            terminalPersonId,
            rawText: event.rawText
        });
        return {
            eventId,
            deviceId: context.deviceId,
            direction: context.direction,
            occurredAt: context.occurredAt,
            terminalPersonId,
            rawPayload: event.rawText
        };
    }
}
