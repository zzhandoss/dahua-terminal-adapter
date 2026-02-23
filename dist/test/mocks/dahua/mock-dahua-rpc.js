import { createHash } from "node:crypto";
export function handleRpcLogin(params) {
    const bodyParams = asObject(params.body.params);
    const incomingPassword = String(bodyParams.password ?? "");
    const session = "mock-session";
    if (!incomingPassword) {
        params.res.setHeader("content-type", "application/json");
        params.res.end(JSON.stringify({
            id: params.body.id ?? 1,
            session,
            result: false,
            params: {
                random: params.random,
                realm: params.realm,
                encryption: "Default"
            },
            error: {
                code: 268632079,
                message: "need second login"
            }
        }));
        return;
    }
    const expected = createExpectedLoginPassword({
        username: params.username,
        password: params.password,
        random: params.random,
        realm: params.realm
    });
    if (incomingPassword !== expected) {
        params.res.setHeader("content-type", "application/json");
        params.res.end(JSON.stringify({
            id: params.body.id ?? 1,
            session,
            result: false,
            params: {},
            error: {
                code: 401,
                message: "invalid login"
            }
        }));
        return;
    }
    params.res.setHeader("content-type", "application/json");
    params.res.end(JSON.stringify({
        id: params.body.id ?? 1,
        session,
        result: true,
        params: {
            keepAliveInterval: 60
        }
    }));
}
export function handleRpc(body, res) {
    const method = String(body.method ?? "");
    res.setHeader("content-type", "application/json");
    if (method === "global.logout") {
        res.end(JSON.stringify({ id: body.id ?? 1, session: "mock-session", result: true, params: {} }));
        return;
    }
    if (method === "global.keepAlive") {
        res.end(JSON.stringify({ id: body.id ?? 1, session: "mock-session", result: true, params: { timeout: 300 } }));
        return;
    }
    res.end(JSON.stringify({
        id: body.id ?? 1,
        session: "mock-session",
        result: false,
        params: {},
        error: { code: 268632064, message: "method not mocked" }
    }));
}
function createExpectedLoginPassword(params) {
    const first = createHash("md5")
        .update(`${params.username}:${params.realm}:${params.password}`)
        .digest("hex")
        .toUpperCase();
    return createHash("md5")
        .update(`${params.username}:${params.random}:${first}`)
        .digest("hex")
        .toUpperCase();
}
function asObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    return value;
}
