import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { N8nClient } from "../n8n-client.js";

export function register(server: McpServer, client: N8nClient): void {
  server.tool(
    "manage_data_tables",
    "Manage n8n data tables — create, read, update, delete tables and query/insert/update/upsert/delete rows",
    {
      action: z.enum([
        "list",
        "get",
        "create",
        "update",
        "delete",
        "query_rows",
        "insert_rows",
        "update_rows",
        "upsert_row",
        "delete_rows",
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
            result = await client.get("/data-tables", filters);
            break;
          case "get":
            if (!id) throw new Error("id is required for get");
            result = await client.get(`/data-tables/${id}`);
            break;
          case "create":
            if (!data) throw new Error("data is required for create");
            result = await client.post("/data-tables", data);
            break;
          case "update":
            if (!id) throw new Error("id is required for update");
            if (!data) throw new Error("data is required for update");
            result = await client.patch(`/data-tables/${id}`, data);
            break;
          case "delete":
            if (!id) throw new Error("id is required for delete");
            result = await client.delete(`/data-tables/${id}`);
            break;
          case "query_rows":
            if (!id) throw new Error("id is required for query_rows");
            result = await client.get(`/data-tables/${id}/rows`, filters);
            break;
          case "insert_rows":
            if (!id) throw new Error("id is required for insert_rows");
            if (!data) throw new Error("data is required for insert_rows");
            result = await client.post(`/data-tables/${id}/rows`, data);
            break;
          case "update_rows":
            if (!id) throw new Error("id is required for update_rows");
            if (!data) throw new Error("data is required for update_rows");
            result = await client.patch(`/data-tables/${id}/rows/update`, data);
            break;
          case "upsert_row":
            if (!id) throw new Error("id is required for upsert_row");
            if (!data) throw new Error("data is required for upsert_row");
            result = await client.post(`/data-tables/${id}/rows/upsert`, data);
            break;
          case "delete_rows":
            if (!id) throw new Error("id is required for delete_rows");
            if (!data) throw new Error("data is required for delete_rows");
            result = await client.post(`/data-tables/${id}/rows/delete`, data);
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
