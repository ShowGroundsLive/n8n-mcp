#!/usr/bin/env node

import express, { RequestHandler } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  mcpAuthRouter,
  getOAuthProtectedResourceMetadataUrl,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { N8nClient } from './n8n-client.js';
import { N8N_API_URL, N8N_API_KEY, PORT, TRANSPORT, MCP_AUTH_TOKEN, MCP_SERVER_URL } from './constants.js';
import { SimpleOAuthProvider } from './oauth.js';
import { register as registerWorkflows } from './tools/workflows.js';
import { register as registerExecutions } from './tools/executions.js';
import { register as registerCredentials } from './tools/credentials.js';
import { register as registerTags } from './tools/tags.js';
import { register as registerUsers } from './tools/users.js';
import { register as registerVariables } from './tools/variables.js';
import { register as registerProjects } from './tools/projects.js';
import { register as registerDataTables } from './tools/data-tables.js';
import { register as registerSourceControl } from './tools/source-control.js';
import { register as registerAudit } from './tools/audit.js';

if (!N8N_API_URL) {
  console.error('Error: N8N_API_URL environment variable is required');
  process.exit(1);
}
if (!N8N_API_KEY) {
  console.error('Error: N8N_API_KEY environment variable is required');
  process.exit(1);
}

function createServer(): McpServer {
  const client = new N8nClient(N8N_API_URL, N8N_API_KEY);
  const server = new McpServer({ name: 'n8n-mcp', version: '1.0.0' });

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

  return server;
}

if (TRANSPORT === 'stdio') {
  const server = createServer();
  const transport = new StdioServerTransport();
  server.connect(transport).catch((err) => {
    console.error('Failed to start stdio transport:', err);
    process.exit(1);
  });
} else {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: false }));

  const mcpHandlers: RequestHandler[] = [];

  if (MCP_AUTH_TOKEN) {
    if (!MCP_SERVER_URL) {
      console.error(
        'Warning: MCP_SERVER_URL not set — OAuth flow for Claude Desktop will not work correctly.'
      );
    }

    const issuerUrl = new URL(MCP_SERVER_URL || `http://localhost:${PORT}`);
    const mcpServerUrl = new URL(`${issuerUrl.origin}/mcp`);
    const persistPath = process.env.OAUTH_STATE_PATH || '/data/oauth-state.json';
    const provider = new SimpleOAuthProvider(MCP_AUTH_TOKEN, 'n8n MCP', persistPath);

    app.get('/authorize', (req, res, next) => {
      const clientId = req.query['client_id'] as string | undefined;
      const redirectUri = req.query['redirect_uri'] as string | undefined;
      if (clientId && redirectUri) {
        provider.ensureClient(clientId, redirectUri);
      }
      next();
    });

    app.use(
      mcpAuthRouter({
        provider,
        issuerUrl,
        resourceServerUrl: mcpServerUrl,
        scopesSupported: ['mcp'],
        resourceName: 'n8n MCP',
      })
    );

    app.post('/oauth/login', async (req, res) => {
      const { session_id, token } = req.body as { session_id?: string; token?: string };
      if (!session_id || !token) {
        res.status(400).send('Missing session_id or token');
        return;
      }
      const result = await provider.handleLogin(session_id, token);
      if (result.success) {
        res.redirect(result.redirectUrl);
      } else {
        res.status(401).send(
          `<html><body style="font-family:system-ui;max-width:400px;margin:80px auto;padding:0 20px">` +
            `<p style="color:red">${result.error}</p>` +
            `<a href="javascript:history.back()">Try again</a></body></html>`
        );
      }
    });

    mcpHandlers.push(
      requireBearerAuth({
        verifier: provider,
        resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
      })
    );

    console.error('Auth configured — /mcp requires Bearer token or OAuth flow');
  }

  app.post('/mcp', ...mcpHandlers, async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', n8n: N8N_API_URL });
  });

  const host = process.env.HOST || '0.0.0.0';
  app.listen(PORT, host, () => {
    console.log(`n8n MCP server running on http://${host}:${PORT}/mcp`);
    console.log(`  n8n URL: ${N8N_API_URL}`);
  });
}
