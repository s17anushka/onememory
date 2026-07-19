import pg from "pg";
import { pipeline } from "@xenova/transformers";

const { Pool } = pg;

// Reused across warm invocations -- avoids re-downloading the model or
// re-opening connections on every request (keeps this comfortably inside
// the Lambda free tier: 1M requests + 400,000 GB-seconds/month).
let pool;
let extractor;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.COCKROACH_DATABASE_URL,
      ssl: { rejectUnauthorized: true },
      max: 3,
    });
  }
  return pool;
}

async function getExtractor() {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractor;
}

async function embed(text) {
  const model = await getExtractor();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

/**
 * Lambda Function URL handler.
 * POST /remember { content, sourceTool, project? }
 * POST /recall   { query, project?, limit? }
 */
export const handler = async (event) => {
  try {
    const path = event.rawPath || event.path || "/";
    const body = event.body ? JSON.parse(event.body) : {};
    const db = getPool();

    if (path.endsWith("/remember")) {
      const { content, sourceTool = "onememory-web", project } = body;
      if (!content) return response(400, { error: "content is required" });

      const vector = await embed(content);
      const result = await db.query(
        `INSERT INTO memories (source_tool, project, content, embedding)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [sourceTool, project ?? null, content, JSON.stringify(vector)]
      );
      return response(200, { id: result.rows[0].id });
    }

    if (path.endsWith("/recall")) {
      const { query, project, limit = 5 } = body;
      if (!query) return response(400, { error: "query is required" });

      const vector = await embed(query);
      const whereProject = project ? "AND project = $2" : "";
      const args = [JSON.stringify(vector)];
      if (project) args.push(project);
      args.push(limit);

      const result = await db.query(
        `SELECT id, source_tool, project, content, created_at,
                embedding <-> $1 AS distance
         FROM memories
         WHERE true ${whereProject}
         ORDER BY embedding <-> $1
         LIMIT $${args.length}`,
        args
      );
      return response(200, { memories: result.rows });
    }

    return response(404, { error: "not found. use /remember or /recall" });
  } catch (err) {
    console.error(err);
    return response(500, { error: err.message });
  }
};
