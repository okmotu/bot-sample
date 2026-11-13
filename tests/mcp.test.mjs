import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ApiError } from '../src/game/client.mjs';
import { gameMcpServer } from '../src/mcp/server.mjs';

test('real MCP handshake, tools, action arguments and safe error reporting',async()=>{
 let submitted;
 const server=gameMcpServer({state:async()=>({version:2,actions:[{type:'pass'}]}),act:async(s,i)=>{submitted={...s,i};return {ok:true};},say:async()=>{throw new ApiError(409,'private detail');}});
 const c=new Client({name:'test',version:'1'});
 const [a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);await c.connect(b);
 assert.equal(c.getServerCapabilities().experimental?.['claude/channel'],undefined);
 assert.deepEqual((await c.listTools()).tools.map(t=>t.name),['game_state','game_action','trade_message']);
 assert.equal(JSON.parse((await c.callTool({name:'game_state',arguments:{}})).content[0].text).version,2);
 await c.callTool({name:'game_action',arguments:{version:2,gameNumber:1,actionIndex:0}});
 assert.deepEqual(submitted,{version:2,gameNumber:1,i:0});
 const error=await c.callTool({name:'trade_message',arguments:{version:2,gameNumber:1,tradeId:1,messageId:'same-id',text:'Привет'}});
 assert.equal(error.isError,true);assert.doesNotMatch(JSON.stringify(error),/private detail/);
 await c.close();await server.close();
});
