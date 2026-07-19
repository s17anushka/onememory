#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { remember, recall } from "./db.js";

const server = new McpServer({
  name: "onememory",
  version: "1.0.0",
});

server.tool(
  "remember",
  "Store a fact, preference, or decision in the shared cross-tool memory layer (CockroachDB). " +
    "Use this whenever the user states something worth remembering across future sessions or tools.",
  {
    content: z.string().describe("The fact/preference/decision to remember, in plain text."),
    project: z
      .string()
      .optional()
      .describe("Optional project/workspace name to scope this memory to."),
  },
  async ({ content, project }) => {
    const { id } = await remember({
      content,
      sourceTool: process.env.ONEMEMORY_SOURCE_TOOL ?? "unknown-tool",
      project,
    });
    return {
      content: [
        {
          type: "text",
          text: `Stored memory ${id}.`,
        },
      ],
    };
  }
);

server.tool(
  "recall",
  "Semantically search the shared cross-tool memory layer for facts/preferences/decisions " +
    "relevant to the current task, regardless of which tool originally stored them. " +
    "Call this before answering when past context might matter.",
  {
    query: z.string().describe("What you want to recall, in plain text."),
    project: z.string().optional().describe("Optional project/workspace name to scope recall to."),
    limit: z.number().int().positive().max(20).optional(),
  },
  async ({ query, project, limit }) => {
    const memories = await recall({ query, project, limit });
    if (memories.length === 0) {
      return { content: [{ type: "text", text: "No relevant memories found." }] };
    }
    const text = memories
      .map(
        (m, i) =>
          `${i + 1}. [${m.source_tool}${m.project ? `/${m.project}` : ""}] ${m.content} ` +
          `(stored ${m.created_at}, distance ${m.distance?.toFixed(4)})`
      )
      .join("\n");
    return { content: [{ type: "text", text }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
