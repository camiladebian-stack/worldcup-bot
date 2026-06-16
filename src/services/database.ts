import { Pool, QueryResult, QueryResultRow } from "pg";

let pool: Pool | null = null;
let useDatabase = false;

const notifiedEvents = new Map<string, boolean>();

function dbKey(matchId: number, eventType: string): string {
  return `${matchId}:${eventType}`;
}

export function isDatabaseAvailable(): boolean {
  return useDatabase;
}

export function initializePool(databaseUrl: string): Pool {
  if (pool) return pool;
  if (!databaseUrl || databaseUrl.includes("@host:") || databaseUrl.includes("@host/")) {
    console.log("[DB] No valid DATABASE_URL found, using in-memory storage");
    useDatabase = false;
    return null as any;
  }
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
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

      CREATE TABLE IF NOT EXISTS bot_config (
        guild_id VARCHAR(50) PRIMARY KEY,
        notification_channel_id VARCHAR(50),
        ping_role_id VARCHAR(50),
        competition_code VARCHAR(20) DEFAULT 'WC',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_notified_events_match_id
        ON notified_events(match_id, event_type);

      CREATE INDEX IF NOT EXISTS idx_notified_events_date
        ON notified_events(match_date);
    `);
    console.log("[DB] Database tables initialized");
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
  if (!useDatabase || !pool) return;
  try {
    await pool.query(
      "DELETE FROM notified_events WHERE match_date < NOW() - INTERVAL '1 day' * $1",
      [daysOld]
    );
  } catch {
    // ignore
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    useDatabase = false;
  }
}
