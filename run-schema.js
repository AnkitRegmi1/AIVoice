import pg from "pg";
import fs from "fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL in the environment first.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.startsWith("postgresql://") && !url.includes("localhost") ? { rejectUnauthorized: false } : undefined,
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
