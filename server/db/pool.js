import pg from "pg";
import { config } from "../config.js";

const { Pool } = pg;
const requiresSsl = /sslmode=(?:require|verify-ca|verify-full)/i.test(config.DATABASE_URL);
export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: requiresSsl || config.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
});

export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
