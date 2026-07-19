-- OneMemory: shared cross-tool agent memory layer
-- Run this against your CockroachDB Serverless (free tier) cluster.
--
-- Usage:
--   cockroach sql --url "$COCKROACH_DATABASE_URL" -f schema.sql

CREATE DATABASE IF NOT EXISTS onememory;
USE onememory;

-- Core memory table.
-- Each row is one atomic "fact" learned from any tool (Claude Code, Cursor, custom bot, etc.)
CREATE TABLE IF NOT EXISTS memories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_tool     STRING NOT NULL,        -- e.g. 'claude-code', 'cursor', 'onememory-web'
    project         STRING,                 -- optional project/workspace name for scoping
    content         STRING NOT NULL,        -- the raw fact/preference/decision text
    embedding       VECTOR(384) NOT NULL,   -- all-MiniLM-L6-v2 produces 384-dim embeddings
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_recalled_at TIMESTAMPTZ,
    recall_count    INT8 NOT NULL DEFAULT 0
);

-- Distributed vector index for fast semantic recall across any amount of data.
-- CockroachDB's native vector indexing keeps this consistent with the rest of
-- the row (no separate vector store to keep in sync).
CREATE VECTOR INDEX IF NOT EXISTS memories_embedding_idx
    ON memories (embedding vector_cosine_ops);

-- Helpful secondary index for scoping recall to a project.
CREATE INDEX IF NOT EXISTS memories_project_idx ON memories (project);

-- Example query: semantic recall of the 5 most relevant memories for a project
--
-- SELECT id, content, source_tool, created_at
-- FROM memories
-- WHERE project = $1
-- ORDER BY embedding <-> $2   -- $2 = query embedding, cosine distance
-- LIMIT 5;
