import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { N8nClient } from "../n8n-client.js";

export function register(server: McpServer, client: N8nClient): void {
  server.tool(
    "manage_workflows",
    "Manage n8n workflows — create, read, update, delete, activate, deactivate, and manage tags",
    {
      action: z.enum([
        "list",
        "get",
        "create",
        "update",
        "delete",
        "activate",
        "deactivate",
        "get_tags",
        "update_tags",
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
            result = await client.get("/workflows", filters);
            break;
          case "get":
            if (!id) throw new Error("id is required for get");
            result = await client.get(`/workflows/${id}`);
            break;
          case "create":
            if (!data) throw new Error("data is required for create");
            result = await client.post("/workflows", data);
            break;
          case "update":
            if (!id) throw new Error("id is required for update");
            if (!data) throw new Error("data is required for update");
            result = await client.put(`/workflows/${id}`, data);
            break;
          case "delete":
            if (!id) throw new Error("id is required for delete");
            result = await client.delete(`/workflows/${id}`);
            break;
          case "activate":
            if (!id) throw new Error("id is required for activate");
            result = await client.post(`/workflows/${id}/activate`);
            break;
          case "deactivate":
            if (!id) throw new Error("id is required for deactivate");
            result = await client.post(`/workflows/${id}/deactivate`);
            break;
          case "get_tags":
            if (!id) throw new Error("id is required for get_tags");
            result = await client.get(`/workflows/${id}/tags`);
            break;
          case "update_tags":
            if (!id) throw new Error("id is required for update_tags");
            if (!data) throw new Error("data is required for update_tags");
            result = await client.put(`/workflows/${id}/tags`, data);
            break;
          case "transfer":
            if (!id) throw new Error("id is required for transfer");
            if (!data) throw new Error("data is required for transfer");
            result = await client.put(`/workflows/${id}/transfer`, data);
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
