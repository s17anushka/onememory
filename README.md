# OneMemory — a shared, cross-tool memory layer for AI agents

**Built for the CockroachDB × AWS Hackathon.**

Every AI coding tool today (Claude Code, Cursor, custom bots) has amnesia the
moment you switch tools. Tell Claude Code a preference, open Cursor an hour
later, and you're explaining it all over again. **OneMemory** fixes this by
giving every MCP-compatible agent a single, persistent, semantically
searchable memory — backed by CockroachDB.

Store a fact in one tool. Recall it, automatically, from any other.

## How it works

```
Claude Code ──┐
Cursor       ──┼──►  OneMemory MCP Server  ──►  CockroachDB
Any MCP tool ──┘        (local embeddings)       (vector index)

                 AWS Lambda (Function URL)
                        │
                        ▼
              Same memory layer, over HTTP
              (for web dashboards / other clients)
```

- **Storage & recall logic** lives in a small MCP server. Any MCP-compatible
  agent can call two tools: `remember` and `recall`.
- **Embeddings are generated locally** (`Xenova/all-MiniLM-L6-v2`, running
  in-process via `@xenova/transformers`) — no paid embedding API, so the
  whole project runs on free tiers.
- **CockroachDB** is the single source of truth: one `memories` table with a
  native **Distributed Vector Index** for semantic search, so recall stays
  fast as memory grows, with no separate vector store to keep in sync.
- **AWS Lambda** exposes the same logic over a Function URL (free tier — no
  API Gateway charge), so the memory layer isn't locked to one machine or
  one tool's process.

## CockroachDB tools used

1. **CockroachDB Cloud Managed MCP Server / MCP integration** — the whole
   project *is* an MCP server backed by CockroachDB; Claude Code and Cursor
   connect to it directly via `mcp.json` config.
2. **Distributed Vector Indexing** — the `memories` table has a
   `VECTOR(384)` column with a `vector_cosine_ops` index (see
   `schema/schema.sql`), used for semantic recall in both the MCP server and
   the Lambda handler.

## AWS services used

- **AWS Lambda** — hosts an HTTP-accessible copy of the memory layer via a
  Function URL, entirely within the AWS free tier (1M requests +
  400,000 GB-seconds/month, no charge).

## Setup

### 1. CockroachDB (free Serverless cluster)

1. Create a free CockroachDB Serverless cluster at
   [cockroachlabs.cloud](https://cockroachlabs.cloud).
2. Copy the connection string.
3. Run the schema:
   ```bash
   cockroach sql --url "$COCKROACH_DATABASE_URL" -f schema/schema.sql
   ```

### 2. MCP server (for Claude Code / Cursor)

```bash
cd mcp-server
npm install
npm run build
```

Add to your MCP client config (e.g. Claude Code's `mcp.json`):

```json
{
  "mcpServers": {
    "onememory": {
      "command": "node",
      "args": ["/absolute/path/to/onememory/mcp-server/dist/index.js"],
      "env": {
        "COCKROACH_DATABASE_URL": "postgresql://...",
        "ONEMEMORY_SOURCE_TOOL": "claude-code"
      }
    }
  }
}
```

Repeat for Cursor with `"ONEMEMORY_SOURCE_TOOL": "cursor"` — same
`COCKROACH_DATABASE_URL`, same memories, different tool.

### 3. AWS Lambda (free tier)

```bash
cd lambda
npm install
zip -r function.zip .
```

Then, in the AWS Console (or CLI):

```bash
aws lambda create-function \
  --function-name onememory \
  --runtime nodejs20.x \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --role <your-lambda-execution-role-arn> \
  --timeout 30 \
  --memory-size 512 \
  --environment "Variables={COCKROACH_DATABASE_URL=postgresql://...}"

aws lambda create-function-url-config \
  --function-name onememory \
  --auth-type NONE
```

Test it:

```bash
curl -X POST https://<your-function-url>/remember \
  -H "content-type: application/json" \
  -d '{"content": "This project uses CockroachDB Serverless, free tier.", "sourceTool": "onememory-web", "project": "hackathon-demo"}'

curl -X POST https://<your-function-url>/recall \
  -H "content-type: application/json" \
  -d '{"query": "what database are we using?", "project": "hackathon-demo"}'
```

## Demo script (for the submission video)

1. In Claude Code: state a project preference or decision. Show it get
   stored (`remember` tool call).
2. Open Cursor (same `COCKROACH_DATABASE_URL`, different
   `ONEMEMORY_SOURCE_TOOL`): ask a related question. Show it recall the
   fact from Claude Code automatically, with no re-explaining.
3. Show the CockroachDB console: the `memories` table, the vector index,
   and the row that was just inserted.
4. Hit the Lambda Function URL directly with `curl` to show the same
   memory is accessible over plain HTTP, independent of any single tool or
   machine.

## Why this matters

Agent memory today is trapped per-tool. OneMemory treats memory as
infrastructure — durable, portable, and queryable by any agent that speaks
MCP — which is exactly the role CockroachDB is built to play.
