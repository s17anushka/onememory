import pg from "pg";
import { embed } from "./embeddings.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.COCKROACH_DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

export interface Memory {
  id: string;
  source_tool: string;
  project: string | null;
  content: string;
  created_at: string;
  distance?: number;
}

/**
 * Stores a new fact/preference/decision as a memory, embedding it locally.
 */
export async function remember(params: {
  content: string;
  sourceTool: string;
  project?: string;
}): Promise<{ id: string }> {
  const vector = await embed(params.content);
  const result = await pool.query(
    `INSERT INTO memories (source_tool, project, content, embedding)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [params.sourceTool, params.project ?? null, params.content, JSON.stringify(vector)]
  );
  return { id: result.rows[0].id };
}

/**
 * Semantically recalls the most relevant memories for a query, optionally
 * scoped to a project, regardless of which tool originally stored them.
 */
export async function recall(params: {
  query: string;
  project?: string;
  limit?: number;
}): Promise<Memory[]> {
  const vector = await embed(params.query);
  const limit = params.limit ?? 5;

  const whereProject = params.project ? `AND project = $2` : "";
  const args: unknown[] = [JSON.stringify(vector)];
  if (params.project) args.push(params.project);
  args.push(limit);

  const result = await pool.query(
    `SELECT id, source_tool, project, content, created_at,
            embedding <-> $1 AS distance
     FROM memories
     WHERE true ${whereProject}
     ORDER BY embedding <-> $1
     LIMIT $${args.length}`,
    args
  );

  if (result.rows.length > 0) {
    const ids = result.rows.map((r) => r.id);
    await pool.query(
      `UPDATE memories
       SET last_recalled_at = now(), recall_count = recall_count + 1
       WHERE id = ANY($1::uuid[])`,
      [ids]
    );
  }

  return result.rows;
}
