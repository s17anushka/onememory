import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Free, no-LLM test of the OneMemory MCP server.
// Connects directly as an MCP client and calls the `remember` and `recall`
// tools, exactly like Claude Code / Cursor would -- just without an LLM
// in the loop, so this costs nothing to run.

const transport = new StdioClientTransport({
  command: "node",
  args: ["./dist/index.js"],
  env: {
    ...process.env,
    COCKROACH_DATABASE_URL: process.env.COCKROACH_DATABASE_URL,
    ONEMEMORY_SOURCE_TOOL: "test-script",
  },
});

const client = new Client({ name: "onememory-test-client", version: "1.0.0" });
await client.connect(transport);

console.log("Connected. Available tools:");
const tools = await client.listTools();
console.log(tools.tools.map((t) => t.name));

console.log("\nCalling remember...");
const rememberResult = await client.callTool({
  name: "remember",
  arguments: {
    content:
      "This hackathon project uses CockroachDB Serverless on AWS Mumbai region as the persistent memory layer.",
    project: "hackathon-demo",
  },
});
console.log(rememberResult.content[0].text);

console.log("\nCalling recall...");
const recallResult = await client.callTool({
  name: "recall",
  arguments: {
    query: "what database and region does this project use?",
    project: "hackathon-demo",
  },
});
console.log(recallResult.content[0].text);

await client.close();
process.exit(0);
