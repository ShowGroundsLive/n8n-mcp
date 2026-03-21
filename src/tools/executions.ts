import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { N8nClient } from "../n8n-client.js";

export function register(server: McpServer, client: N8nClient): void {
  server.tool(
    "manage_executions",
    "Manage n8n executions — list, get details, delete, retry failed, stop running, and manage annotation tags",
    {
      action: z.enum([
        "list",
        "get",
        "delete",
        "retry",
        "stop",
        "get_tags",
        "update_tags",
      ]),
      id: z.string().optional(),
      data: z.record(z.string(), z.unknown()).optional(),
      filters: z.record(z.string(), z.unknown()).optional(),
    },
    async ({ action, id, data, filters }) => {
      try {
        let result: unknown;

        switch (action) {
          case "list":
            result = await client.get("/executions", filters);
            break;

          case "get":
            if (!id) throw new Error("id is required for get");
            result = await client.get(`/executions/${id}`);
            break;

          case "delete":
            if (!id) throw new Error("id is required for delete");
            result = await client.delete(`/executions/${id}`);
            break;

          case "retry":
            if (!id) throw new Error("id is required for retry");
            result = await client.post(`/executions/${id}/retry`);
            break;

          case "stop":
            if (!id) throw new Error("id is required for stop");
            result = await client.post(`/executions/${id}/stop`);
            break;

          case "get_tags":
            if (!id) throw new Error("id is required for get_tags");
            result = await client.get(`/executions/${id}/tags`);
            break;

          case "update_tags":
            if (!id) throw new Error("id is required for update_tags");
            result = await client.put(`/executions/${id}/tags`, data);
            break;
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: error instanceof Error ? error.message : String(error),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
