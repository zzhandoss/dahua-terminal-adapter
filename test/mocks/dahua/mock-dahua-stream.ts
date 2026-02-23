import type { ServerResponse } from "node:http";

export type MockDahuaEventScriptItem = {
  payload: string;
  delayMs?: number;
};

export type StreamClient = {
  res: ServerResponse;
  timerIds: NodeJS.Timeout[];
};

export function streamScenario(
  client: StreamClient,
  scenario: MockDahuaEventScriptItem[],
  boundary: string
): void {
  let offset = 0;

  for (const item of scenario) {
    offset += item.delayMs ?? 10;
    const timer = setTimeout(() => {
      if (client.res.writableEnded) {
        return;
      }
      const part =
        `--${boundary}\r\n` +
        "Content-Type: text/plain\r\n" +
        `Content-Length: ${Buffer.byteLength(item.payload, "utf8")}\r\n\r\n` +
        `${item.payload}\r\n`;
      client.res.write(part);
    }, offset);
    client.timerIds.push(timer);
  }

  const closer = setTimeout(() => {
    if (client.res.writableEnded) {
      return;
    }
    client.res.end(`--${boundary}--\r\n`);
  }, offset + 20);
  client.timerIds.push(closer);
}

export function closeStream(client: StreamClient): void {
  for (const timer of client.timerIds) {
    clearTimeout(timer);
  }
  client.timerIds = [];
  if (!client.res.writableEnded) {
    client.res.end();
  }
}
