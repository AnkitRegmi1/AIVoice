/**
 * Run all migrations in migrations/ without needing psql.
 * From project root: node run-migration.js
 */
import "dotenv/config";
import pg from "pg";
import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env");
  process.exit(1);
}

const migrationsDir = join(__dirname, "migrations");
const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

function clientSsl(connectionString) {
  if (/localhost|127\.0\.0\.1/.test(connectionString)) return undefined;
  if (
    connectionString.includes("amazonaws.com") ||
    connectionString.includes("supabase.co") ||
    connectionString.includes("pooler.supabase.com")
  ) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: clientSsl(DATABASE_URL),
});

try {
  await client.connect();
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const statements = sql
      .split(";")
      .map((s) => s.replace(/--[^\n]*/g, "").trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await client.query(stmt);
      console.log("OK:", file, "-", stmt.slice(0, 40).replace(/\s+/g, " ") + "...");
    }
  }
  console.log("Migrations complete.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
