import test from "node:test";
import assert from "node:assert/strict";

import { usePostgresSsl } from "../lib/db.js";

test("usePostgresSsl disables TLS for localhost connections", () => {
  assert.equal(usePostgresSsl("postgres://user:pass@localhost:5432/app"), undefined);
  assert.equal(usePostgresSsl("postgres://user:pass@127.0.0.1:5432/app"), undefined);
});

test("usePostgresSsl enables TLS for Supabase connections", () => {
  assert.deepEqual(
    usePostgresSsl("postgres://user:pass@db.project.supabase.co:5432/postgres"),
    { rejectUnauthorized: false }
  );
});

test("usePostgresSsl enables TLS for Supabase pooler connections", () => {
  assert.deepEqual(
    usePostgresSsl("postgres://user:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres"),
    { rejectUnauthorized: false }
  );
});

test("usePostgresSsl enables TLS for Amazon RDS connections", () => {
  assert.deepEqual(
    usePostgresSsl("postgres://user:pass@demo.abcdefg.us-east-1.rds.amazonaws.com:5432/app"),
    { rejectUnauthorized: false }
  );
});

test("usePostgresSsl leaves unknown hosted postgres unchanged", () => {
  assert.equal(usePostgresSsl("postgres://user:pass@db.example.com:5432/app"), undefined);
});
