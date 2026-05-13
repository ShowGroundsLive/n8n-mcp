import dotenv from 'dotenv';

dotenv.config();

export const N8N_API_URL = process.env.N8N_API_URL?.replace(/\/$/, '') || '';
export const N8N_API_KEY = process.env.N8N_API_KEY || '';
export const PORT = parseInt(process.env.PORT || '3000', 10);
export const TRANSPORT = process.env.TRANSPORT || 'http';
export const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || '';
export const MCP_SERVER_URL = process.env.MCP_SERVER_URL || '';
