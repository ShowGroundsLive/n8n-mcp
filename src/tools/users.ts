import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { N8nClient } from "../n8n-client.js";

export function register(server: McpServer, client: N8nClient): void {
  server.tool(
    "manage_users",
    "Manage n8n users — list, get, create, delete, and change roles",
    {
      action: z.enum(["list", "get", "create", "delete", "change_role"]),
      id: z.string().optional(),
      data: z.record(z.string(), z.unknown()).optional(),
      filters: z.record(z.string(), z.unknown()).optional(),
    },
    async ({ action, id, data, filters }) => {
      try {
        let result: unknown;

        switch (action) {
          case "list":
            result = await client.get("/users", filters);
            break;
          case "get":
            if (!id) throw new Error("id is required for get");
            result = await client.get(`/users/${id}`);
            break;
          case "create":
            if (!data) throw new Error("data is required for create");
            result = await client.post("/users", data);
            break;
          case "delete":
            if (!id) throw new Error("id is required for delete");
            result = await client.delete(`/users/${id}`);
            break;
          case "change_role":
            if (!id) throw new Error("id is required for change_role");
            if (!data) throw new Error("data is required for change_role");
            result = await client.patch(`/users/${id}/role`, data);
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
