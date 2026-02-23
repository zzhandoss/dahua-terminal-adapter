export function parseFaceRecognitionEventBody(body) {
    if (body.includes("Code=") && body.includes(";data={")) {
        return parseCompactEvent(body);
    }
    return parseExpandedEvent(body);
}
function parseExpandedEvent(body) {
    const kv = parseKeyValueLines(body);
    const code = kv["Events[0].EventBaseInfo.Code"];
    if (!code) {
        return null;
    }
    const action = kv["Events[0].EventBaseInfo.Action"] ?? "Pulse";
    const index = Number.parseInt(kv["Events[0].EventBaseInfo.Index"] ?? "0", 10);
    const uid = kv["Events[0].UID"] ?? null;
    const candidates = collectCandidates(kv, "Events[0].Candidates");
    return { code, action, index: Number.isNaN(index) ? 0 : index, uid, candidates, raw: kv };
}
function parseCompactEvent(body) {
    const prefix = body.slice(0, body.indexOf(";data={"));
    const raw = parseSemicolonPairs(prefix);
    const code = raw.Code;
    if (!code) {
        return null;
    }
    const action = raw.action ?? "Pulse";
    const index = Number.parseInt(raw.index ?? "0", 10);
    return {
        code,
        action,
        index: Number.isNaN(index) ? 0 : index,
        uid: null,
        candidates: [],
        raw
    };
}
function parseKeyValueLines(input) {
    const out = {};
    for (const line of input.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        const idx = trimmed.indexOf("=");
        if (idx < 0) {
            continue;
        }
        out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
    }
    return out;
}
function parseSemicolonPairs(input) {
    const out = {};
    for (const token of input.split(";")) {
        const idx = token.indexOf("=");
        if (idx < 0) {
            continue;
        }
        out[token.slice(0, idx)] = token.slice(idx + 1);
    }
    return out;
}
function collectCandidates(kv, prefix) {
    const safePrefix = escapeRegex(prefix);
    const indexes = new Set();
    for (const key of Object.keys(kv)) {
        const m = key.match(new RegExp(`^${safePrefix}\\[(\\d+)\\]\\.`));
        if (m) {
            indexes.add(Number.parseInt(m[1] ?? "0", 10));
        }
    }
    return [...indexes]
        .sort((a, b) => a - b)
        .map((i) => {
        const base = `${prefix}[${i}]`;
        const similarityRaw = kv[`${base}.Similarity`];
        return {
            similarity: similarityRaw ? Number.parseInt(similarityRaw, 10) : null,
            person: {
                uid: kv[`${base}.Person.UID`] ?? null,
                groupId: kv[`${base}.Person.GroupID`] ?? null,
                name: kv[`${base}.Person.Name`] ?? null,
                certificateId: kv[`${base}.Person.ID`] ?? null
            }
        };
    });
}
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
