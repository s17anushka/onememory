import pg from "pg";
import { writeFileSync } from "fs";

const { Pool } = pg;

// Exports all memories from CockroachDB into a JSON file that can be
// uploaded to S3 for the public-facing dashboard (index.html reads this).
const pool = new Pool({
  connectionString: process.env.COCKROACH_DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

const result = await pool.query(
  `SELECT id, source_tool, project, content, created_at, recall_count
   FROM memories
   ORDER BY created_at DESC`
);

const payload = {
  generated_at: new Date().toISOString(),
  count: result.rows.length,
  memories: result.rows,
};

writeFileSync("memories.json", JSON.stringify(payload, null, 2));
console.log(`Exported ${result.rows.length} memories to memories.json`);

await pool.end();
