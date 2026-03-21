import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { N8nClient } from "../n8n-client.js";

export function register(server: McpServer, client: N8nClient): void {
  server.tool(
    "manage_projects",
    "Manage n8n projects — create, update, delete projects and manage project members",
    {
      action: z.enum([
        "list",
        "create",
        "update",
        "delete",
        "list_members",
        "add_member",
        "remove_member",
        "change_member_role",
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
            result = await client.get("/projects", filters);
            break;
          case "create":
            if (!data) throw new Error("data is required for create");
            result = await client.post("/projects", data);
            break;
          case "update":
            if (!id) throw new Error("id is required for update");
            if (!data) throw new Error("data is required for update");
            result = await client.put(`/projects/${id}`, data);
            break;
          case "delete":
            if (!id) throw new Error("id is required for delete");
            result = await client.delete(`/projects/${id}`);
            break;
          case "list_members":
            if (!id) throw new Error("id is required for list_members");
            result = await client.get(`/projects/${id}/users`);
            break;
          case "add_member":
            if (!id) throw new Error("id is required for add_member");
            if (!data) throw new Error("data is required for add_member");
            result = await client.post(`/projects/${id}/users`, data);
            break;
          case "remove_member": {
            if (!id) throw new Error("id is required for remove_member");
            if (!data?.userId) throw new Error("data.userId is required for remove_member");
            const removeUserId = data.userId as string;
            result = await client.delete(`/projects/${id}/users/${removeUserId}`);
            break;
          }
          case "change_member_role": {
            if (!id) throw new Error("id is required for change_member_role");
            if (!data?.userId) throw new Error("data.userId is required for change_member_role");
            const patchUserId = data.userId as string;
            result = await client.patch(`/projects/${id}/users/${patchUserId}`, data);
            break;
          }
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
