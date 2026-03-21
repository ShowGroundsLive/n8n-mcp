#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { N8nClient } from "./n8n-client.js";
import { register as registerWorkflows } from "./tools/workflows.js";
import { register as registerExecutions } from "./tools/executions.js";
import { register as registerCredentials } from "./tools/credentials.js";
import { register as registerTags } from "./tools/tags.js";
import { register as registerUsers } from "./tools/users.js";
import { register as registerVariables } from "./tools/variables.js";
import { register as registerProjects } from "./tools/projects.js";
import { register as registerDataTables } from "./tools/data-tables.js";
import { register as registerSourceControl } from "./tools/source-control.js";
import { register as registerAudit } from "./tools/audit.js";

const N8N_API_URL = process.env.N8N_API_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_URL) {
  console.error("Error: N8N_API_URL environment variable is required");
  process.exit(1);
}

if (!N8N_API_KEY) {
  console.error("Error: N8N_API_KEY environment variable is required");
  process.exit(1);
}

const client = new N8nClient(N8N_API_URL, N8N_API_KEY);

const server = new McpServer({
  name: "n8n-mcp",
  version: "1.0.0",
});

registerWorkflows(server, client);
registerExecutions(server, client);
registerCredentials(server, client);
registerTags(server, client);
registerUsers(server, client);
registerVariables(server, client);
registerProjects(server, client);
registerDataTables(server, client);
registerSourceControl(server, client);
registerAudit(server, client);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("n8n MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
