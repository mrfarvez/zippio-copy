import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const migrationsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const files = (await fs.readdir(migrationsPath)).filter((file) => file.endsWith(".sql")).sort();

await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
for (const filename of files) {
  const alreadyApplied = await pool.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [filename]);
  if (alreadyApplied.rowCount) continue;
  const sql = await fs.readFile(path.join(migrationsPath, filename), "utf8");
  await pool.query("BEGIN");
  try {
    await pool.query(sql);
    await pool.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
    await pool.query("COMMIT");
    console.log(`Applied ${filename}`);
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}
await pool.end();
