# Pangolin MCP Server — Design Spec

## Overview

An MCP (Model Context Protocol) server that exposes Pangolin reverse proxy management operations as tools for LLMs. Enables AI assistants to create, configure, and manage sites, resources, targets, users, and roles through Pangolin's integration API.

## Goals

- Provide full programmatic control of a Pangolin instance via MCP tools
- Phase 1: Sites, Resources, Targets, Users, Roles (core management)
- Phase 2: Domains, Clients, API Keys, Blueprints, Audit Logs (full coverage)
- Follow the same patterns as the existing n8n-mcp server for consistency

## Non-Goals

- Auth flows (login/signup/2FA) — the server uses API key auth, not sessions
- Internal router endpoints (Gerbil, Badger, Traefik config) — these are for inter-service communication
- Real-time WebSocket connections

## Stack

- **Language:** TypeScript (ES2022, strict mode, ES modules)
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Validation:** `zod`
- **Runtime:** Node.js
- **Package manager:** npm

## Configuration

Environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `PANGOLIN_API_URL` | Yes | Base URL for the Pangolin integration API (e.g., `https://pangolin.example.com/api/v1`) |
| `PANGOLIN_API_KEY` | Yes | Scoped API key for the integration API |
| `PANGOLIN_ORG_ID` | No | Default org ID — used when `orgId` is not provided in a tool call |

Note: `PANGOLIN_API_URL` should include the full path including `/api/v1`. The client uses this as-is without appending any path prefix.

## Project Structure

```
pangolin-mcp/
├── src/
│   ├── index.ts              # MCP server entry point, registers all tools
│   ├── pangolin-client.ts    # HTTP client for Pangolin integration API
│   └── tools/
│       ├── sites.ts          # Phase 1
│       ├── resources.ts      # Phase 1: Resource CRUD
│       ├── resource-access.ts # Phase 1: Resource auth & role/user assignment
│       ├── resource-rules.ts # Phase 1: Resource rules
│       ├── targets.ts        # Phase 1
│       ├── users.ts          # Phase 1
│       ├── roles.ts          # Phase 1
│       ├── domains.ts        # Phase 2
│       ├── clients.ts        # Phase 2
│       ├── api-keys.ts       # Phase 2
│       ├── blueprints.ts     # Phase 2
│       └── audit.ts          # Phase 2
├── package.json
├── tsconfig.json
└── .env.example
```

## PangolinClient

Thin HTTP wrapper class:

- **Methods:** `get(path, query?)`, `post(path, body?)`, `put(path, body?)`, `patch(path, body?)`, `delete(path)`
- **Auth:** Auto-injects API key header on every request (either `Authorization: Bearer <key>` or a custom header — to be confirmed against the Pangolin API)
- **Base URL:** From `PANGOLIN_API_URL` env var, used as-is (no path appended)
- **Query params:** `get()` accepts an optional `query` object, serialized to URL query string. Used for filters, pagination, etc.
- **`resolveOrgId(orgId?: string)`:** Returns provided orgId, falls back to `PANGOLIN_ORG_ID` env var. If neither is set, throws: `"orgId is required — provide it as a parameter or set the PANGOLIN_ORG_ID environment variable"`
- **Error handling:** Catches HTTP errors and returns status code + response body
- **Response format:** All API responses are returned as `JSON.stringify(result, null, 2)` text content

## HTTP Method Note

The Pangolin API uses non-standard HTTP method conventions in some places. These are intentional and match the actual API:
- **Creates** generally use `PUT` (not `POST`)
- **Updates** generally use `POST` (not `PUT` or `PATCH`)
- **Exception:** Domain updates use `PATCH`
- **Exception:** Invitations use `POST` for creation

## Tool Design Pattern

Each tool file exports a `register(server, client)` function. Tools are registered via `server.tool(name, description, schema, handler)`. Each tool handles multiple actions via a switch statement on the `action` parameter. Zod is used for parameter validation.

All tools share this base schema pattern:

```ts
{
  action: z.enum([...]),                              // required
  orgId: z.string().optional(),                       // falls back to env var
  data: z.record(z.string(), z.unknown()).optional(),  // create/update payloads
  filters: z.record(z.string(), z.unknown()).optional() // query params for list/search
}
```

Additional ID parameters are added per tool as needed (e.g., `siteId`, `resourceId`, `targetId`).

Error responses use: `{ isError: true, content: [{ type: "text", text: "..." }] }`

## Phase 1 Tools

### `manage_sites`

Manage Pangolin sites within an organization.

**Schema:**
```ts
{
  action: z.enum(["list", "get", "create", "update", "delete", "pick_defaults"]),
  orgId: z.string().optional(),
  siteId: z.string().optional(),
  niceId: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
}
```

| Action | Description | Key Params | Endpoint |
|--------|-------------|------------|----------|
| `list` | List all sites in org | `orgId` | `GET /org/:orgId/sites` |
| `get` | Get site by ID or nice ID | `siteId` or `orgId` + `niceId` | `GET /site/:siteId` or `GET /org/:orgId/site/:niceId` |
| `create` | Create a new site | `orgId`, `data` | `PUT /org/:orgId/site` |
| `update` | Update a site | `siteId`, `data` | `POST /site/:siteId` |
| `delete` | Delete a site | `siteId` | `DELETE /site/:siteId` |
| `pick_defaults` | Get defaults for new site creation | `orgId` | `GET /org/:orgId/pick-site-defaults` |

### `manage_resources`

CRUD operations for proxied resources/services — Pangolin's core concept.

**Schema:**
```ts
{
  action: z.enum(["list", "get", "create", "update", "delete"]),
  orgId: z.string().optional(),
  resourceId: z.string().optional(),
  siteId: z.string().optional(),
  niceId: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
}
```

| Action | Description | Key Params | Endpoint |
|--------|-------------|------------|----------|
| `list` | List resources in org or site | `orgId`, `siteId` (optional) | `GET /org/:orgId/resources` or `GET /site/:siteId/resources` |
| `get` | Get resource | `resourceId` or `orgId` + `niceId` | `GET /resource/:resourceId` |
| `create` | Create resource | `orgId`, `data`, `siteId` (optional) | `PUT /org/:orgId/resource` or `PUT /org/:orgId/site/:siteId/resource` |
| `update` | Update resource | `resourceId`, `data` | `POST /resource/:resourceId` |
| `delete` | Delete resource | `resourceId` | `DELETE /resource/:resourceId` |

### `manage_resource_access`

Manage authentication and role/user assignments on resources.

**Schema:**
```ts
{
  action: z.enum(["list_roles", "set_roles", "list_users", "set_users", "set_password", "set_pincode", "set_whitelist", "get_whitelist", "set_header_auth"]),
  resourceId: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
}
```

| Action | Description | Key Params | Endpoint |
|--------|-------------|------------|----------|
| `list_roles` | List roles assigned to resource | `resourceId` | `GET /resource/:resourceId/roles` |
| `set_roles` | Set roles on resource | `resourceId`, `data` | `POST /resource/:resourceId/roles` |
| `list_users` | List users assigned to resource | `resourceId` | `GET /resource/:resourceId/users` |
| `set_users` | Set users on resource | `resourceId`, `data` | `POST /resource/:resourceId/users` |
| `set_password` | Set password auth on resource | `resourceId`, `data` | `POST /resource/:resourceId/password` |
| `set_pincode` | Set pincode auth on resource | `resourceId`, `data` | `POST /resource/:resourceId/pincode` |
| `set_whitelist` | Set email whitelist | `resourceId`, `data` | `POST /resource/:resourceId/whitelist` |
| `get_whitelist` | Get email whitelist | `resourceId` | `GET /resource/:resourceId/whitelist` |
| `set_header_auth` | Set header auth on resource | `resourceId`, `data` | `POST /resource/:resourceId/header-auth` |

### `manage_resource_rules`

Manage rules on resources.

**Schema:**
```ts
{
  action: z.enum(["list", "create", "update", "delete"]),
  resourceId: z.string(),
  ruleId: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
}
```

| Action | Description | Key Params | Endpoint |
|--------|-------------|------------|----------|
| `list` | List resource rules | `resourceId` | `GET /resource/:resourceId/rules` |
| `create` | Create resource rule | `resourceId`, `data` | `PUT /resource/:resourceId/rule` |
| `update` | Update resource rule | `resourceId`, `ruleId`, `data` | `POST /resource/:resourceId/rule/:ruleId` |
| `delete` | Delete resource rule | `resourceId`, `ruleId` | `DELETE /resource/:resourceId/rule/:ruleId` |

### `manage_targets`

Manage upstream targets for resources.

**Schema:**
```ts
{
  action: z.enum(["list", "get", "create", "update", "delete"]),
  resourceId: z.string().optional(),
  targetId: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
}
```

| Action | Description | Key Params | Endpoint |
|--------|-------------|------------|----------|
| `list` | List targets for resource | `resourceId` | `GET /resource/:resourceId/targets` |
| `get` | Get target | `targetId` | `GET /target/:targetId` |
| `create` | Create target | `resourceId`, `data` | `PUT /resource/:resourceId/target` |
| `update` | Update target | `targetId`, `data` | `POST /target/:targetId` |
| `delete` | Delete target | `targetId` | `DELETE /target/:targetId` |

### `manage_users`

Manage users and invitations within an organization.

**Schema:**
```ts
{
  action: z.enum(["list", "get", "create", "update", "delete", "list_invitations", "create_invite", "delete_invite"]),
  orgId: z.string().optional(),
  userId: z.string().optional(),
  inviteId: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
}
```

| Action | Description | Key Params | Endpoint |
|--------|-------------|------------|----------|
| `list` | List org users | `orgId` | `GET /org/:orgId/users` |
| `get` | Get org user | `orgId`, `userId` | `GET /org/:orgId/user/:userId` |
| `create` | Create org user | `orgId`, `data` | `PUT /org/:orgId/user` |
| `update` | Update org user | `orgId`, `userId`, `data` | `POST /org/:orgId/user/:userId` |
| `delete` | Remove user from org | `orgId`, `userId` | `DELETE /org/:orgId/user/:userId` |
| `list_invitations` | List pending invitations | `orgId` | `GET /org/:orgId/invitations` |
| `create_invite` | Invite user to org | `orgId`, `data` | `POST /org/:orgId/create-invite` |
| `delete_invite` | Remove invitation | `orgId`, `inviteId` | `DELETE /org/:orgId/invitations/:inviteId` |

### `manage_roles`

Manage roles and role assignments.

**Schema:**
```ts
{
  action: z.enum(["list", "get", "create", "update", "delete", "add_user", "remove_user"]),
  orgId: z.string().optional(),
  roleId: z.string().optional(),
  userId: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
}
```

| Action | Description | Key Params | Endpoint |
|--------|-------------|------------|----------|
| `list` | List roles in org | `orgId` | `GET /org/:orgId/roles` |
| `get` | Get role | `roleId` | `GET /role/:roleId` |
| `create` | Create role | `orgId`, `data` | `PUT /org/:orgId/role` |
| `update` | Update role | `roleId`, `data` | `POST /role/:roleId` |
| `delete` | Delete role | `roleId` | `DELETE /role/:roleId` |
| `add_user` | Add user to role | `roleId`, `userId` | `POST /role/:roleId/add/:userId` |
| `remove_user` | Remove user from role | `roleId`, `userId` | `POST /role/:roleId/remove/:userId` |

## Phase 2 Tools

### `manage_domains`

**Schema:**
```ts
{
  action: z.enum(["list", "get", "create", "update", "delete", "get_dns_records", "restart"]),
  orgId: z.string().optional(),
  domainId: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
}
```

| Action | Description | Key Params | Endpoint |
|--------|-------------|------------|----------|
| `list` | List domains in org | `orgId` | `GET /org/:orgId/domains` |
| `get` | Get domain | `orgId`, `domainId` | `GET /org/:orgId/domain/:domainId` |
| `create` | Create domain | `orgId`, `data` | `PUT /org/:orgId/domain` |
| `update` | Update domain | `orgId`, `domainId`, `data` | `PATCH /org/:orgId/domain/:domainId` |
| `delete` | Delete domain | `orgId`, `domainId` | `DELETE /org/:orgId/domain/:domainId` |
| `get_dns_records` | Get DNS records | `orgId`, `domainId` | `GET /org/:orgId/domain/:domainId/dns-records` |
| `restart` | Restart domain | `orgId`, `domainId` | `POST /org/:orgId/domain/:domainId/restart` |

### `manage_clients`

**Schema:**
```ts
{
  action: z.enum(["list", "get", "create", "update", "delete", "archive", "unarchive", "block", "unblock"]),
  orgId: z.string().optional(),
  clientId: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
}
```

| Action | Description | Key Params | Endpoint |
|--------|-------------|------------|----------|
| `list` | List clients in org | `orgId` | `GET /org/:orgId/clients` |
| `get` | Get client | `clientId` | `GET /client/:clientId` |
| `create` | Create client | `orgId`, `data` | `PUT /org/:orgId/client` |
| `update` | Update client | `clientId`, `data` | `POST /client/:clientId` |
| `delete` | Delete client | `clientId` | `DELETE /client/:clientId` |
| `archive` | Archive client | `clientId` | `POST /client/:clientId/archive` |
| `unarchive` | Unarchive client | `clientId` | `POST /client/:clientId/unarchive` |
| `block` | Block client | `clientId` | `POST /client/:clientId/block` |
| `unblock` | Unblock client | `clientId` | `POST /client/:clientId/unblock` |

### `manage_api_keys`

**Schema:**
```ts
{
  action: z.enum(["list", "create", "delete", "list_actions", "set_actions"]),
  orgId: z.string().optional(),
  apiKeyId: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
}
```

| Action | Description | Key Params | Endpoint |
|--------|-------------|------------|----------|
| `list` | List org API keys | `orgId` | `GET /org/:orgId/api-keys` |
| `create` | Create org API key | `orgId`, `data` | `PUT /org/:orgId/api-key` |
| `delete` | Delete API key | `orgId`, `apiKeyId` | `DELETE /org/:orgId/api-key/:apiKeyId` |
| `list_actions` | List API key actions/scopes | `orgId`, `apiKeyId` | `GET /org/:orgId/api-key/:apiKeyId/actions` |
| `set_actions` | Set API key actions/scopes | `orgId`, `apiKeyId`, `data` | `POST /org/:orgId/api-key/:apiKeyId/actions` |

### `manage_blueprints`

**Schema:**
```ts
{
  action: z.enum(["list", "get", "apply"]),
  orgId: z.string().optional(),
  blueprintId: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
}
```

| Action | Description | Key Params | Endpoint |
|--------|-------------|------------|----------|
| `list` | List blueprints in org | `orgId` | `GET /org/:orgId/blueprints` |
| `get` | Get blueprint | `orgId`, `blueprintId` | `GET /org/:orgId/blueprint/:blueprintId` |
| `apply` | Apply blueprint (JSON) | `orgId`, `data` | `PUT /org/:orgId/blueprint` |

### `manage_audit`

**Schema:**
```ts
{
  action: z.enum(["query_logs", "query_analytics", "export_logs"]),
  orgId: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
}
```

| Action | Description | Key Params | Endpoint |
|--------|-------------|------------|----------|
| `query_logs` | Query request audit logs | `orgId`, `filters` | `GET /org/:orgId/logs/request` |
| `query_analytics` | Query request analytics | `orgId`, `filters` | `GET /org/:orgId/logs/analytics` |
| `export_logs` | Export audit logs | `orgId`, `filters` | `GET /org/:orgId/logs/request/export` |

## Data Flow

1. LLM sends tool call (e.g., `manage_sites` with `action: "list"`)
2. MCP server validates params with Zod
3. `resolveOrgId()` determines org ID (param > env var > error)
4. `PangolinClient` makes HTTP request to integration API with API key auth
5. Response is returned as `JSON.stringify(result, null, 2)` text content to the LLM

## Pagination

List endpoints pass the `filters` parameter through as query params. This allows the caller to provide any pagination parameters the Pangolin API supports (cursor, limit, offset, etc.) without the MCP server needing to know the pagination scheme.

## Implementation Order

1. Project scaffolding (package.json, tsconfig, index.ts)
2. `PangolinClient` with auth, query params, and error handling
3. `manage_sites` — simplest CRUD, validates the pattern works
4. `manage_resources` — core resource CRUD
5. `manage_resource_access` — auth and role/user assignment
6. `manage_resource_rules` — resource rules
7. `manage_targets` — simple CRUD, tightly coupled with resources
8. `manage_roles` — needed before users for role assignment
9. `manage_users` — user and invitation management
10. Test against live instance
11. Phase 2 tools (domains, clients, api-keys, blueprints, audit)
