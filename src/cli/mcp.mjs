import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readSession } from '../game/session.mjs';
import { client } from '../game/client.mjs';
import { gameMcpServer } from '../mcp/server.mjs';
import { publicMetadata,syncMetadata } from '../game/metadata.mjs';
try {
  const session=await readSession();
  if(!session)throw new Error('Missing bot session.');
  const api=client(session);
  // The external MCP agent's model is unknown unless BOT_MODEL is provided.
  await syncMetadata(api,await api.state(),publicMetadata(process.env,null));
  await gameMcpServer(api).connect(new StdioServerTransport());
} catch {console.error('Сначала подключите бота через npm start -- --connect-only.');process.exitCode=1;}
