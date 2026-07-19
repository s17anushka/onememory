# 🧠 OneMemory

### A shared, cross-tool memory layer for AI agents — backed by CockroachDB.

> Built for the **CockroachDB × AWS Hackathon**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CockroachDB](https://img.shields.io/badge/CockroachDB-Serverless-6933FF)](https://cockroachlabs.cloud)
[![AWS](https://img.shields.io/badge/AWS-S3-FF9900)](https://aws.amazon.com/s3/)
[![MCP](https://img.shields.io/badge/MCP-compatible-black)](https://modelcontextprotocol.io)

**Live demo:** `<paste your S3 static website URL here>`
`

---

## The problem

Every AI coding tool today has amnesia the moment you switch context. Tell
Claude Code a preference or a project decision, then open Cursor an hour
later — and you're explaining it all over again. Memory today is trapped
**per tool**, not owned by the person using the tools.

## The idea

**OneMemory** gives every MCP-compatible agent a single, persistent,
semantically searchable memory layer. Store a fact once, from any tool.
Recall it later, automatically, from any *other* tool — because the memory
doesn't live in the tool. It lives in CockroachDB.

```
Claude Code ──┐
Cursor       ──┼──►  OneMemory MCP Server  ──►  CockroachDB
Any MCP tool ──┘        (local embeddings)      (persistent memory +
                                                  distributed vector index)

                                    │
                                    ▼
                    export-memories.mjs (Node script)
                                    │
                                    ▼
                     Amazon S3 (static website hosting)
                     — a public, live dashboard of every
                       memory the agent has ever learned
```

## How it works

1. **Store** — Claude Code (or any MCP client) calls the `remember` tool.
   The MCP server embeds the text locally and writes it to CockroachDB.
2. **Recall** — A different tool, a different session, calls `recall`. The
   MCP server runs a semantic similarity search over CockroachDB's
   **Distributed Vector Index** and returns the most relevant memories —
   regardless of which tool originally stored them.
3. **Prove it** — An export script pulls the full memory table out of
   CockroachDB and publishes it as a live, human-readable dashboard hosted
   on **Amazon S3**, so anyone can see the memory layer working without
   needing terminal access.

## Why this matters

Agent memory today is a feature bolted onto one app. OneMemory treats
memory as **infrastructure** — durable, portable, and queryable by any
agent that speaks MCP. That's exactly the role CockroachDB is built to
play: a system of record that's always on, globally consistent, and
natively wired into the agent toolchain.

---

## CockroachDB tools used

| Tool | How it's used |
|---|---|
| **MCP Server** | The entire project *is* an MCP server backed by CockroachDB — Claude Code and Cursor connect to it directly as a persistent memory tool. |
| **Distributed Vector Indexing** | The `memories` table has a `VECTOR(384)` column with a `vector_cosine_ops` index (`schema/schema.sql`), used for semantic recall in `db.ts`. |

## AWS services used

| Service | How it's used |
|---|---|
| **Amazon S3** | Hosts a live, public static-website dashboard (`index.html` + `memories.json`) that mirrors what's stored in CockroachDB — a transparent, always-current view into the agent's memory, with zero server to maintain. |

---

## Project structure

```
onememory/
├── schema/
│   └── schema.sql          # CockroachDB table + distributed vector index
├── mcp-server/
│   ├── src/
│   │   ├── index.ts        # MCP server: remember + recall tools
│   │   ├── db.ts           # CockroachDB read/write logic
│   │   └── embeddings.ts   # local, free embedding generation
│   ├── test-client.mjs     # standalone test client (no LLM required)
│   ├── export-memories.mjs # exports CockroachDB → memories.json
│   ├── index.html          # static dashboard, deployed to S3
│   └── setup-s3.ps1        # one-shot S3 bucket + hosting automation
├── docs/
│   └── mcp-config-example.json
├── README.md
└── LICENSE
```

---

## Setup

### 1. CockroachDB (free Serverless cluster)

1. Create a free cluster at [cockroachlabs.cloud](https://cockroachlabs.cloud).
2. Copy the connection string.
3. Run the schema (via the CockroachDB SQL Shell or `cockroach sql`):
   ```sql
   -- see schema/schema.sql for the full script
   CREATE TABLE IF NOT EXISTS memories (...);
   CREATE VECTOR INDEX IF NOT EXISTS memories_embedding_idx
       ON memories (embedding vector_cosine_ops);
   ```

### 2. MCP server (Claude Code / Cursor)

```bash
cd mcp-server
npm install
npm run build
```

Register it with Claude Code:

```bash
claude mcp add onememory --transport stdio -- node "/absolute/path/to/mcp-server/dist/index.js"
```

Then add `COCKROACH_DATABASE_URL` and `ONEMEMORY_SOURCE_TOOL` to the
server's `env` block in your Claude Code config (see
`docs/mcp-config-example.json`). Repeat for Cursor with a different
`ONEMEMORY_SOURCE_TOOL` value — same database, same memories.

### 3. Test without an LLM (free, instant)

```bash
node test-client.mjs
```

This connects to the MCP server directly and calls `remember` /
`recall`, proving the whole pipeline works without spending any API
credits.

### 4. Publish the live dashboard to S3

```bash
node export-memories.mjs   # CockroachDB -> memories.json
./setup-s3.ps1             # creates bucket, enables hosting, uploads files
```

---

## Demo script

1. In Claude Code, state a project decision or preference — watch the
   `remember` tool fire.
2. Open Cursor (same database, different `ONEMEMORY_SOURCE_TOOL`) and ask
   a related question — watch it `recall` the fact from Claude Code, with
   no re-explaining.
3. Re-run `export-memories.mjs` and refresh the S3-hosted dashboard —
   the new memory appears live, publicly, with no server to manage.
4. Show the CockroachDB console: the `memories` table and its vector
   index, proving the data's source of truth.

---

## License

MIT — see [LICENSE](LICENSE).