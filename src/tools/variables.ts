import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { N8nClient } from "../n8n-client.js";

export function register(server: McpServer, client: N8nClient): void {
  server.tool(
    "manage_variables",
    "Manage n8n variables — list, create, update, delete environment variables",
    {
      action: z.enum(["list", "create", "update", "delete"]),
      id: z.string().optional(),
      data: z.record(z.string(), z.unknown()).optional(),
      filters: z.record(z.string(), z.unknown()).optional(),
    },
    async ({ action, id, data, filters }) => {
      try {
        let result: unknown;

        switch (action) {
          case "list":
            result = await client.get("/variables", filters);
            break;
          case "create":
            if (!data) throw new Error("data is required for create");
            result = await client.post("/variables", data);
            break;
          case "update":
            if (!id) throw new Error("id is required for update");
            if (!data) throw new Error("data is required for update");
            result = await client.put(`/variables/${id}`, data);
            break;
          case "delete":
            if (!id) throw new Error("id is required for delete");
            result = await client.delete(`/variables/${id}`);
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
