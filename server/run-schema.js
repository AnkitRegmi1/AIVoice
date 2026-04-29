import "dotenv/config";
import pg from "pg";
import fs from "fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL in .env (see .env.example).");
  process.exit(1);
}

function poolSsl(connectionString) {
  if (!connectionString.startsWith("postgresql://")) return undefined;
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

const pool = new pg.Pool({
  connectionString: url,
  ssl: poolSsl(url),
});

const sql = fs.readFileSync("schema.sql", "utf8");
pool
  .query(sql)
  .then(() => {
    console.log("Schema applied successfully.");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
