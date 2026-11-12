import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadSession } from './session.mjs';
import { client } from './client.mjs';
import { gameMcpServer } from './mcp-server.mjs';
try {
  const session=await loadSession(false);
  await gameMcpServer(client(session)).connect(new StdioServerTransport());
} catch {console.error('Сначала подключите бота через npm run connect.');process.exitCode=1;}
