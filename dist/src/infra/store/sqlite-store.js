import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
export class SqliteStore {
    db;
    constructor(dbPath) {
        mkdirSync(dirname(dbPath), { recursive: true });
        this.db = new Database(dbPath);
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("synchronous = NORMAL");
        this.migrate();
    }
    close() {
        this.db.close();
    }
    upsertEvent(event, retentionMs) {
        const now = Date.now();
        const expiresAt = now + retentionMs;
        this.db
            .prepare(`INSERT INTO events
          (event_id, device_id, direction, occurred_at, terminal_person_id, raw_payload, acked, created_at, expires_at)
         VALUES
          (@eventId, @deviceId, @direction, @occurredAt, @terminalPersonId, @rawPayload, 0, @createdAt, @expiresAt)
         ON CONFLICT(device_id, event_id) DO NOTHING`)
            .run({
            ...event,
            createdAt: now,
            expiresAt
        });
    }
    listPending(limit) {
        return this.db
            .prepare(`SELECT seq, event_id as eventId, device_id as deviceId, direction, occurred_at as occurredAt,
                terminal_person_id as terminalPersonId, raw_payload as rawPayload, acked, created_at as createdAt
         FROM events
         WHERE acked = 0
         ORDER BY seq ASC
         LIMIT ?`)
            .all(limit)
            .map((row) => ({
            ...row,
            acked: Boolean(row.acked)
        }));
    }
    markAcked(deviceId, eventId) {
        const tx = this.db.transaction(() => {
            this.db
                .prepare("UPDATE events SET acked = 1 WHERE device_id = ? AND event_id = ?")
                .run(deviceId, eventId);
            this.db
                .prepare(`INSERT INTO device_state(device_id, last_acked_event_id, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(device_id)
           DO UPDATE SET last_acked_event_id = excluded.last_acked_event_id, updated_at = excluded.updated_at`)
                .run(deviceId, eventId, Date.now());
        });
        tx();
    }
    getLastAckedEventId(deviceId) {
        const row = this.db
            .prepare("SELECT last_acked_event_id FROM device_state WHERE device_id = ?")
            .get(deviceId);
        return row?.last_acked_event_id ?? null;
    }
    setLastAckedEventId(deviceId, eventId) {
        this.db
            .prepare(`INSERT INTO device_state(device_id, last_acked_event_id, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(device_id)
         DO UPDATE SET last_acked_event_id = excluded.last_acked_event_id, updated_at = excluded.updated_at`)
            .run(deviceId, eventId, Date.now());
    }
    getBackfill(deviceId, sinceEventId, limit) {
        if (!sinceEventId) {
            return this.db
                .prepare(`SELECT event_id as eventId, device_id as deviceId, direction, occurred_at as occurredAt,
                  terminal_person_id as terminalPersonId, raw_payload as rawPayload
           FROM events
           WHERE device_id = ?
           ORDER BY seq ASC
           LIMIT ?`)
                .all(deviceId, limit);
        }
        const sinceRow = this.db
            .prepare("SELECT seq FROM events WHERE device_id = ? AND event_id = ?")
            .get(deviceId, sinceEventId);
        if (!sinceRow) {
            return this.db
                .prepare(`SELECT event_id as eventId, device_id as deviceId, direction, occurred_at as occurredAt,
                  terminal_person_id as terminalPersonId, raw_payload as rawPayload
           FROM events
           WHERE device_id = ?
           ORDER BY seq ASC
           LIMIT ?`)
                .all(deviceId, limit);
        }
        return this.db
            .prepare(`SELECT event_id as eventId, device_id as deviceId, direction, occurred_at as occurredAt,
                terminal_person_id as terminalPersonId, raw_payload as rawPayload
         FROM events
         WHERE device_id = ? AND seq > ?
         ORDER BY seq ASC
         LIMIT ?`)
            .all(deviceId, sinceRow.seq, limit);
    }
    purgeExpired() {
        const result = this.db.prepare("DELETE FROM events WHERE expires_at <= ?").run(Date.now());
        return result.changes;
    }
    migrate() {
        const hasEventsTable = this.db
            .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'events'`)
            .get();
        if (hasEventsTable) {
            const columns = this.db.prepare("PRAGMA table_info(events)").all();
            const hasLegacyIdentityColumn = columns.some((column) => column.name === "iin");
            const hasDirectionColumn = columns.some((column) => column.name === "direction");
            if (hasLegacyIdentityColumn || !hasDirectionColumn) {
                const selectDirection = hasDirectionColumn
                    ? "CASE WHEN direction IN ('IN', 'OUT') THEN direction ELSE 'IN' END"
                    : "'IN'";
                this.db.exec(`BEGIN;
CREATE TABLE events_new (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  terminal_person_id TEXT,
  raw_payload TEXT,
  acked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  UNIQUE(device_id, event_id)
);
INSERT INTO events_new
  (seq, event_id, device_id, direction, occurred_at, terminal_person_id, raw_payload, acked, created_at, expires_at)
SELECT
  seq, event_id, device_id, ${selectDirection},
  occurred_at, terminal_person_id, raw_payload, acked, created_at, expires_at
FROM events;
DROP TABLE events;
ALTER TABLE events_new RENAME TO events;
COMMIT;`);
            }
        }
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        occurred_at INTEGER NOT NULL,
        terminal_person_id TEXT,
        raw_payload TEXT,
        acked INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        UNIQUE(device_id, event_id)
      );

      CREATE INDEX IF NOT EXISTS idx_events_pending ON events(acked, seq);
      CREATE INDEX IF NOT EXISTS idx_events_device_seq ON events(device_id, seq);

      CREATE TABLE IF NOT EXISTS device_state (
        device_id TEXT PRIMARY KEY,
        last_acked_event_id TEXT,
        updated_at INTEGER NOT NULL
      );
    `);
    }
}
