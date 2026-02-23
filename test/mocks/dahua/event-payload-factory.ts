export type MockFaceRecognitionEvent = {
  index: number;
  uid?: string;
  terminalPersonId?: string;
  documentId?: string;
  occurredAt?: string;
  action?: "Pulse" | "Start" | "Stop";
  includeCandidate?: boolean;
  malformed?: boolean;
};

export function makeFaceRecognitionPayload(input: MockFaceRecognitionEvent): string {
  if (input.malformed) {
    return "Events[0].EventBaseInfo.Code=FaceRecognit";
  }

  const action = input.action ?? "Pulse";
  const uid = input.uid ?? `uid-${input.index}`;
  const personUid = input.terminalPersonId ?? `person-${input.index}`;
  const documentId = input.documentId ?? `DOC-${input.index}`;
  const lines = [
    "Events[0].EventBaseInfo.Code=FaceRecognition",
    `Events[0].EventBaseInfo.Action=${action}`,
    `Events[0].EventBaseInfo.Index=${input.index}`,
    `Events[0].UID=${uid}`,
    `Events[0].UTC=${input.occurredAt ?? "2026-02-11 10:00:00"}`
  ];

  if (input.includeCandidate !== false) {
    lines.push(`Events[0].Candidates[0].Person.UID=${personUid}`);
    lines.push(`Events[0].Candidates[0].Person.ID=${documentId}`);
    lines.push("Events[0].Candidates[0].Similarity=97");
  }

  return `${lines.join("\r\n")}\r\n`;
}
