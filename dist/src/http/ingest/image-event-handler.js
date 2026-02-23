import { fail } from "../http-envelope.js";
import { parseBoundary, MultipartStreamParser } from "../../infra/dahua/parsers/multipart.js";
import { parseEventUploadBody, parseImageEventUploadBody, parseTextPlainUploadEvent, parseTextPlainUploadToJson } from "../../infra/dahua/parsers/access-control-push.js";
export async function parseImageEventRequest(request, log) {
    const contentType = request.headers["content-type"];
    const normalizedContentType = String(contentType ?? "").toLowerCase();
    if (normalizedContentType.includes("application/json")) {
        log.info({
            path: "/ingest/image-event",
            rawBody: request.body
        }, "image-event raw body received");
        const parsed = parseImageEventUploadBody(request.body);
        log.info({
            path: "/ingest/image-event",
            parsedBody: request.body
        }, "image-event json body parsed");
        if (parsed) {
            return { ok: true, events: parsed.Events };
        }
        const single = parseEventUploadBody(request.body);
        if (!single) {
            return invalid("invalid image event payload");
        }
        return { ok: true, events: [single] };
    }
    const boundary = parseBoundary(contentType);
    const rawBody = await readRawBody(request);
    const parser = new MultipartStreamParser(boundary);
    const parts = parser.push(rawBody);
    log.info({
        path: "/ingest/image-event",
        rawBodySize: rawBody.length,
        rawBodyPreview: rawBody.slice(0, 8000),
        boundary,
        partCount: parts.length,
        partHeaders: parts.map((part) => part.headers)
    }, "image-event multipart parsed");
    const jsonPart = parts.find((part) => String(part.headers["content-type"] ?? "").toLowerCase().includes("application/json"));
    if (jsonPart) {
        let parsedBody;
        try {
            parsedBody = JSON.parse(jsonPart.body);
        }
        catch {
            return invalid("invalid multipart json");
        }
        log.info({
            path: "/ingest/image-event",
            jsonPartPreview: jsonPart.body.slice(0, 4000),
            parsedBody
        }, "image-event json part parsed");
        const parsed = parseImageEventUploadBody(parsedBody);
        if (!parsed) {
            return invalid("invalid image event payload");
        }
        return { ok: true, events: parsed.Events };
    }
    const textParts = parts.filter((part) => String(part.headers["content-type"] ?? "").toLowerCase().includes("text/plain"));
    const parsedTextEvents = textParts
        .map((part) => ({
        raw: part.body,
        parsedJson: parseTextPlainUploadToJson(part.body),
        event: parseTextPlainUploadEvent(part.body)
    }));
    const nonHeartbeat = parsedTextEvents.filter((item) => {
        const kind = String(item.parsedJson.kind ?? "");
        return kind !== "heartbeat";
    });
    if (nonHeartbeat.length > 0) {
        log.info({
            path: "/ingest/image-event",
            textPartCount: nonHeartbeat.length,
            textParts: nonHeartbeat.map((item) => item.raw),
            parsedTextPayloads: nonHeartbeat.map((item) => item.parsedJson),
            parsedEvents: nonHeartbeat
                .map((item) => item.event)
                .filter((item) => item !== null)
        }, "image-event text/plain parts parsed");
    }
    const events = parsedTextEvents
        .map((item) => item.event)
        .filter((item) => item !== null);
    return { ok: true, events };
}
function invalid(message) {
    return {
        ok: false,
        statusCode: 400,
        payload: fail("invalid_request", message)
    };
}
async function readRawBody(request) {
    if (Buffer.isBuffer(request.body)) {
        return request.body.toString("utf8");
    }
    if (typeof request.body === "string") {
        return request.body;
    }
    const stream = request.raw;
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8");
}
