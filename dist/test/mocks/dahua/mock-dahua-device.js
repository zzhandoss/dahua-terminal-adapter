import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { makeDigestChallengeHeader, parseDigestAuthorization, validateDigestAuth } from "./digest.js";
import { handleRpc, handleRpcLogin } from "./mock-dahua-rpc.js";
import { closeStream, streamScenario } from "./mock-dahua-stream.js";
export function createMockDahuaDevice(options) {
    const host = options.host ?? "127.0.0.1";
    const port = options.port ?? 0;
    const boundary = options.boundary ?? "mock-dahua-boundary";
    const challenge = {
        realm: "Dahua",
        nonce: randomBytes(8).toString("hex"),
        qop: "auth",
        opaque: randomBytes(8).toString("hex")
    };
    const loginRandom = "123456";
    let scenario = options.scenario ? [...options.scenario] : [];
    const streams = new Set();
    let server = null;
    return {
        baseUrl: "",
        setScenario(events) {
            scenario = [...events];
        },
        pushEvent(event) {
            scenario.push(event);
        },
        connections() {
            return streams.size;
        },
        async start() {
            if (server) {
                const address = server.address();
                if (address && typeof address !== "string") {
                    return { baseUrl: `http://${host}:${address.port}` };
                }
                throw new Error("mock server failed to resolve address");
            }
            server = createServer((req, res) => {
                void routeRequest(req, res).catch((error) => {
                    res.statusCode = 500;
                    res.end(`internal error: ${error.message}`);
                });
            });
            await new Promise((resolve, reject) => {
                server?.once("error", reject);
                server?.listen(port, host, () => resolve());
            });
            const address = server.address();
            if (!address || typeof address === "string") {
                throw new Error("mock server failed to resolve address");
            }
            this.baseUrl = `http://${host}:${address.port}`;
            return { baseUrl: this.baseUrl };
        },
        async stop() {
            for (const client of streams) {
                closeStream(client);
            }
            streams.clear();
            if (!server) {
                return;
            }
            const active = server;
            server = null;
            await new Promise((resolve, reject) => {
                active.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            });
        }
    };
    async function routeRequest(req, res) {
        const method = req.method ?? "GET";
        const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
        if (method === "POST" && url.pathname === "/RPC2_Login") {
            const body = await readJson(req);
            handleRpcLogin({
                body,
                username: options.username,
                password: options.password,
                realm: challenge.realm,
                random: loginRandom,
                res
            });
            return;
        }
        if (method === "POST" && url.pathname === "/RPC2") {
            const body = await readJson(req);
            handleRpc(body, res);
            return;
        }
        if (method === "GET" && url.pathname === "/cgi-bin/eventManager.cgi" && url.searchParams.get("action") === "attach") {
            handleEventAttach(req, res, url);
            return;
        }
        res.statusCode = 404;
        res.end("not found");
    }
    function handleEventAttach(req, res, url) {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            rejectUnauthorized(res);
            return;
        }
        const parsed = parseDigestAuthorization(authHeader);
        if (!parsed) {
            rejectUnauthorized(res);
            return;
        }
        const isValid = validateDigestAuth({
            method: "GET",
            username: options.username,
            password: options.password,
            challenge,
            auth: parsed
        });
        if (!isValid) {
            rejectUnauthorized(res);
            return;
        }
        const codes = url.searchParams.get("codes") ?? "";
        if (!codes.includes("FaceRecognition") && codes !== "[All]") {
            res.statusCode = 200;
            res.end();
            return;
        }
        res.statusCode = 200;
        res.setHeader("content-type", `multipart/x-mixed-replace; boundary=${boundary}`);
        res.setHeader("connection", "keep-alive");
        const client = { res, timerIds: [] };
        streams.add(client);
        res.on("close", () => {
            closeStream(client);
            streams.delete(client);
        });
        streamScenario(client, scenario, boundary);
    }
    function rejectUnauthorized(res) {
        res.statusCode = 401;
        res.setHeader("www-authenticate", makeDigestChallengeHeader(challenge));
        res.end("Unauthorized");
    }
}
async function readJson(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length === 0) {
        return {};
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
