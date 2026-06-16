import { Pool, QueryResult, QueryResultRow } from "pg";

let pool: Pool | null = null;

export function initializePool(databaseUrl: string): Pool {
  if (pool) return pool;
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  return pool;
}

export function getPool(): Pool {
  if (!pool) throw new Error("Database pool not initialized");
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function initializeDatabase(): Promise<void> {
  await query(`
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
}

export async function isEventNotified(
  matchId: number,
  eventType: string
): Promise<boolean> {
  const result = await query(
    "SELECT 1 FROM notified_events WHERE match_id = $1 AND event_type = $2",
    [matchId, eventType]
  );
  return result.rowCount! > 0;
}

export async function markEventNotified(
  matchId: number,
  eventType: string,
  matchDate?: Date
): Promise<void> {
  await query(
    `INSERT INTO notified_events (match_id, event_type, match_date)
     VALUES ($1, $2, $3)
     ON CONFLICT (match_id, event_type) DO NOTHING`,
    [matchId, eventType, matchDate || new Date()]
  );
}

export async function cleanupOldEvents(daysOld: number = 7): Promise<void> {
  await query(
    "DELETE FROM notified_events WHERE match_date < NOW() - INTERVAL '1 day' * $1",
    [daysOld]
  );
}

export async function getBotConfig(
  guildId: string
): Promise<{
  notification_channel_id: string;
  ping_role_id: string;
  competition_code: string;
} | null> {
  const result = await query<{
    notification_channel_id: string;
    ping_role_id: string;
    competition_code: string;
  }>(
    "SELECT * FROM bot_config WHERE guild_id = $1",
    [guildId]
  );
  return result.rows[0] || null;
}

export async function setBotConfig(
  guildId: string,
  config: {
    notification_channel_id?: string;
    ping_role_id?: string;
    competition_code?: string;
  }
): Promise<void> {
  const columnNames = ["notification_channel_id", "ping_role_id", "competition_code"] as const;
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const col of columnNames) {
    if (config[col] !== undefined) {
      setClauses.push(`${col} = $${paramIndex++}`);
      values.push(config[col]);
    }
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(guildId);

  const insertCols = ["guild_id", ...columnNames.filter((c) => config[c] !== undefined), "updated_at"];
  const insertVals = [`$1`, ...Array.from({ length: insertCols.length - 2 }, (_, i) => `$${i + 2}`), `NOW()`];

  await query(
    `INSERT INTO bot_config (${insertCols.join(", ")})
     VALUES (${insertVals.join(", ")})
     ON CONFLICT (guild_id) DO UPDATE SET ${setClauses.join(", ")}`,
    [guildId, ...values.slice(0, -1)]
  );
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
