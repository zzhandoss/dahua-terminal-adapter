import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { SqliteStore } from "../../../src/infra/store/sqlite-store.js";
const require = createRequire(import.meta.url);
const sqliteAvailable = (() => {
    try {
        const Database = require("better-sqlite3");
        const db = new Database(":memory:");
        db.close();
        return true;
    }
    catch {
        return false;
    }
})();
function createStore() {
    const dir = mkdtempSync(join(tmpdir(), "dahua-adapter-test-"));
    const dbPath = join(dir, "store.db");
    const store = new SqliteStore(dbPath);
    return {
        store,
        cleanup: () => rmSync(dir, { recursive: true, force: true })
    };
}
const suite = sqliteAvailable ? describe : describe.skip;
suite("SqliteStore", () => {
    it("upserts and acks events", () => {
        const { store, cleanup } = createStore();
        try {
            store.upsertEvent({
                eventId: "evt-1",
                deviceId: "dev-1",
                direction: "IN",
                occurredAt: 1000,
                terminalPersonId: "person-1",
                rawPayload: "{}"
            }, 60000);
            store.upsertEvent({
                eventId: "evt-1",
                deviceId: "dev-1",
                direction: "IN",
                occurredAt: 1000,
                terminalPersonId: "person-1",
                rawPayload: "{}"
            }, 60000);
            const pending = store.listPending(10);
            expect(pending.length).toBe(1);
            expect(pending[0]?.eventId).toBe("evt-1");
            store.markAcked("dev-1", "evt-1");
            expect(store.listPending(10).length).toBe(0);
            expect(store.getLastAckedEventId("dev-1")).toBe("evt-1");
        }
        finally {
            store.close();
            cleanup();
        }
    });
    it("returns backfill after sinceEventId", () => {
        const { store, cleanup } = createStore();
        try {
            store.upsertEvent({
                eventId: "evt-1",
                deviceId: "dev-1",
                direction: "IN",
                occurredAt: 1000,
                terminalPersonId: null,
                rawPayload: "{}"
            }, 60000);
            store.upsertEvent({
                eventId: "evt-2",
                deviceId: "dev-1",
                direction: "IN",
                occurredAt: 2000,
                terminalPersonId: null,
                rawPayload: "{}"
            }, 60000);
            const all = store.getBackfill("dev-1", null, 10);
            const afterFirst = store.getBackfill("dev-1", "evt-1", 10);
            expect(all.map((x) => x.eventId)).toEqual(["evt-1", "evt-2"]);
            expect(afterFirst.map((x) => x.eventId)).toEqual(["evt-2"]);
        }
        finally {
            store.close();
            cleanup();
        }
    });
});
