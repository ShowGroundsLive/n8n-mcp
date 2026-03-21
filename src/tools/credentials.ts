import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { N8nClient } from "../n8n-client.js";

export function register(server: McpServer, client: N8nClient): void {
  server.tool(
    "manage_credentials",
    "Manage n8n credentials — list, create, update, delete, get schema for credential types, and transfer",
    {
      action: z.enum([
        "list",
        "create",
        "update",
        "delete",
        "get_schema",
        "transfer",
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
            result = await client.get("/credentials", filters);
            break;

          case "create":
            result = await client.post("/credentials", data);
            break;

          case "update":
            if (!id) throw new Error("id is required for update");
            result = await client.patch(`/credentials/${id}`, data);
            break;

          case "delete":
            if (!id) throw new Error("id is required for delete");
            result = await client.delete(`/credentials/${id}`);
            break;

          case "get_schema":
            if (!id) throw new Error("id is required for get_schema (credential type name)");
            result = await client.get(`/credentials/schema/${id}`);
            break;

          case "transfer":
            if (!id) throw new Error("id is required for transfer");
            result = await client.put(`/credentials/${id}/transfer`, data);
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
