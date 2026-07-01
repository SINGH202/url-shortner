// db.js — PostgreSQL connection pool + schema bootstrap.

import fs from "fs";
import path from "path";
import { Pool } from "pg";

// Two connection styles:
//  - LOCAL: individual PG* variables (host, port, database).
//  - PRODUCTION (Render): a single DATABASE_URL connection string, over SSL.
// If DATABASE_URL exists we use it; otherwise we fall back to local settings.
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        // Render's managed Postgres requires SSL. This setting accepts its cert.
        ssl: { rejectUnauthorized: false },
      }
    : {
        database: process.env.PGDATABASE || "urlshortener",
        host: process.env.PGHOST || "localhost",
        port: process.env.PGPORT || 5432,
      }
);

// Run schema.sql on startup. Because it uses "CREATE TABLE IF NOT EXISTS",
// it's safe to run every boot — it only creates things that don't exist yet.
// This means we don't have to manually run migrations after deploying.
async function init() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  init,
};
