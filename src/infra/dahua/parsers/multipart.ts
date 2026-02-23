export type MultipartPart = {
  headers: Record<string, string>;
  body: string;
};

export class MultipartStreamParser {
  private buffer = "";
  private readonly boundaryToken: string;

  constructor(boundary: string) {
    this.boundaryToken = `--${boundary}`;
  }

  push(chunk: string): MultipartPart[] {
    this.buffer += chunk;
    const parts: MultipartPart[] = [];

    while (true) {
      const first = this.buffer.indexOf(this.boundaryToken);
      if (first < 0) {
        break;
      }

      const second = this.buffer.indexOf(this.boundaryToken, first + this.boundaryToken.length);
      if (second < 0) {
        if (first > 0) {
          this.buffer = this.buffer.slice(first);
        }
        break;
      }

      const raw = this.buffer.slice(first + this.boundaryToken.length, second);
      this.buffer = this.buffer.slice(second);

      const trimmed = raw.trim();
      if (!trimmed || trimmed === "--") {
        continue;
      }

      const splitIndex = trimmed.indexOf("\r\n\r\n") >= 0
        ? trimmed.indexOf("\r\n\r\n")
        : trimmed.indexOf("\n\n");
      if (splitIndex < 0) {
        continue;
      }

      const head = trimmed.slice(0, splitIndex);
      const body = trimmed.slice(splitIndex + (trimmed.includes("\r\n\r\n") ? 4 : 2));
      const headers = parseHeaders(head);
      parts.push({ headers, body: body.trim() });
    }

    return parts;
  }
}

function parseHeaders(head: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of head.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 0) {
      continue;
    }
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    headers[key] = value;
  }
  return headers;
}

export function parseBoundary(contentType: string | undefined): string {
  if (!contentType) {
    throw new Error("missing content-type header");
  }
  const part = contentType
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("boundary="));
  if (!part) {
    throw new Error("boundary not found");
  }
  return part.slice("boundary=".length).replace(/^"|"$/g, "");
}
