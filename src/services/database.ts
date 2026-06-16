import { Pool } from "pg";

let pool: Pool | null = null;
let useDatabase = false;

const notifiedEvents = new Map<string, boolean>();

function dbKey(matchId: number, eventType: string): string {
  return `${matchId}:${eventType}`;
}

export function isDatabaseAvailable(): boolean {
  return useDatabase;
}

function isValidDatabaseUrl(url: string): boolean {
  if (!url) return false;
  if (url.includes("user:password@") || url.includes("@host:") || url.includes("@host/")) return false;
  try {
    new URL(url);
    return url.startsWith("postgresql://") || url.startsWith("postgres://");
  } catch {
    return false;
  }
}

export function initializePool(databaseUrl: string): Pool | null {
  if (pool) return pool;

  if (!isValidDatabaseUrl(databaseUrl)) {
    console.log("[DB] No valid DATABASE_URL found, using in-memory storage");
    useDatabase = false;
    return null;
  }

  pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  useDatabase = true;
  return pool;
}

export async function initializeDatabase(): Promise<void> {
  if (!useDatabase || !pool) {
    console.log("[DB] Running without database (in-memory mode)");
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notified_events (
        id SERIAL PRIMARY KEY,
        match_id INTEGER NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        notified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        match_date DATE,
        UNIQUE(match_id, event_type)
      );

      CREATE INDEX IF NOT EXISTS idx_notified_events_match_id
        ON notified_events(match_id, event_type);

      CREATE INDEX IF NOT EXISTS idx_notified_events_date
        ON notified_events(match_date);
    `);

    const result = await pool.query("SELECT COUNT(*) as total FROM notified_events");
    const total = parseInt(result.rows[0].total, 10);
    console.log(`[DB] Database initialized with ${total} already-notified events`);

    const byType = await pool.query(
      "SELECT event_type, COUNT(*) as count FROM notified_events GROUP BY event_type"
    );
    for (const row of byType.rows) {
      console.log(`[DB]   ${row.event_type}: ${row.count}`);
    }
  } catch (error) {
    console.warn("[DB] Failed to initialize database, falling back to in-memory:", error);
    useDatabase = false;
  }
}

export async function isEventNotified(
  matchId: number,
  eventType: string
): Promise<boolean> {
  if (!useDatabase || !pool) {
    return notifiedEvents.has(dbKey(matchId, eventType));
  }
  try {
    const result = await pool.query(
      "SELECT 1 FROM notified_events WHERE match_id = $1 AND event_type = $2",
      [matchId, eventType]
    );
    return result.rowCount! > 0;
  } catch {
    return notifiedEvents.has(dbKey(matchId, eventType));
  }
}

export async function markEventNotified(
  matchId: number,
  eventType: string,
  matchDate?: Date
): Promise<void> {
  notifiedEvents.set(dbKey(matchId, eventType), true);
  if (!useDatabase || !pool) return;
  try {
    await pool.query(
      `INSERT INTO notified_events (match_id, event_type, match_date)
       VALUES ($1, $2, $3)
       ON CONFLICT (match_id, event_type) DO NOTHING`,
      [matchId, eventType, matchDate || new Date()]
    );
  } catch {
    // already in memory
  }
}

export async function cleanupOldEvents(daysOld: number = 7): Promise<void> {
  if (useDatabase && pool) {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysOld);
      const cutoffStr = cutoff.toISOString().split("T")[0]; // YYYY-MM-DD
      const result = await pool.query(
        "DELETE FROM notified_events WHERE match_date < $1",
        [cutoffStr]
      );
      if (result.rowCount! > 0) {
        console.log(`[DB] Cleaned up ${result.rowCount} old notified events`);
      }
    } catch {
      // ignore
    }
  }
  // In-memory cleanup: remove entries for matches older than daysOld
  const cutoffMs = Date.now() - daysOld * 86_400_000;
  for (const [key] of notifiedEvents) {
    const parts = key.split(":");
    const matchId = parseInt(parts[0], 10);
    if (!isNaN(matchId) && matchId < cutoffMs) {
      notifiedEvents.delete(key);
    }
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    useDatabase = false;
  }
}
