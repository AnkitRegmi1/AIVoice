import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL in the environment first.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.startsWith("postgresql://") && !url.includes("localhost") ? { rejectUnauthorized: false } : undefined,
});

async function run() {
  try {
    // 1. Check if appointments table exists and list columns
    const tableCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'appointments'
      ORDER BY ordinal_position
    `);
    if (tableCheck.rows.length === 0) {
      console.log("❌ Table 'appointments' does NOT exist. Run: node run-schema.js");
      process.exit(1);
    }
    console.log("✅ Table 'appointments' exists with columns:");
    tableCheck.rows.forEach((r) => console.log("   -", r.column_name, "(", r.data_type, ")"));

    // 2. Count rows
    const countApp = await pool.query("SELECT COUNT(*) FROM appointments");
    const countCalls = await pool.query("SELECT COUNT(*) FROM calls");
    console.log("\n📊 Row counts:");
    console.log("   appointments:", countApp.rows[0].count);
    console.log("   calls:", countCalls.rows[0].count);

    // 3. Show recent appointments (same query the dashboard uses)
    const appointments = await pool.query(
      `SELECT id, caller_name, scheduled_at, created_at
       FROM appointments
       ORDER BY scheduled_at DESC
       LIMIT 10`
    );
    if (appointments.rows.length === 0) {
      console.log("\n⚠️  No appointments in the database. The calendar will be empty until:");
      console.log("   1. You call the Twilio number and complete a booking (give name, date, time), and");
      console.log("   2. Sarah calls the schedule_appointment tool successfully.");
    } else {
      console.log("\n📅 Recent appointments (dashboard calendar reads these):");
      appointments.rows.forEach((r) => {
        console.log("   ", r.id, "|", r.caller_name, "|", r.scheduled_at);
      });
    }

    // 4. Show recent calls (to confirm caller_name/summary)
    const calls = await pool.query(
      `SELECT id, caller_name, LEFT(summary, 60) as summary_preview, created_at
       FROM calls
       ORDER BY created_at DESC
       LIMIT 5`
    );
    if (calls.rows.length > 0) {
      console.log("\n📞 Recent calls:");
      calls.rows.forEach((r) => {
        console.log("   ", r.id, "| caller:", r.caller_name || "(null)", "|", r.summary_preview, "...");
      });
    }

    console.log("\nDone.");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
