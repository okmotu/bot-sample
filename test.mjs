import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { parseInvitation,exchange,client,ApiError } from './client.mjs';
import { chooseWithModel,modelInput } from './llm.mjs';
import { gameMcpServer } from './mcp-server.mjs';

const invite='http://localhost:5177/bot-connect#ABCDEF.'+('a'.repeat(36)+'b'.repeat(36));
test('invitation only goes in POST body; redirects disabled, no token in URLs',async()=>{
 assert.equal(parseInvitation(invite).code,'ABCDEF');
 assert.throws(()=>parseInvitation(invite.replace('localhost:5177','example.com')));
 assert.throws(()=>parseInvitation(invite.replace('/bot-connect','/elsewhere')));
 const calls=[];const transport=async(url,options)=>{calls.push({url,options});return Response.json({token:'secret',playerId:'p',code:'ABCDEF'});};
 const session=await exchange(invite,transport);
 await client(session,transport).state();
 await client(session,transport).act({version:3,gameNumber:1},2);
 assert.equal(calls[0].options.headers.Authorization,undefined);
 assert.equal(JSON.parse(calls[0].options.body).invite,parseInvitation(invite).invite);
 for(const c of calls){assert.equal(c.options.redirect,'error');assert.ok(!c.url.includes('secret'));assert.ok(!c.url.includes('#'));}
 assert.equal(calls[1].options.headers.Authorization,'Bearer secret');
 assert.deepEqual(JSON.parse(calls[2].options.body),{version:3,gameNumber:1,actionIndex:2});
});

test('model receives allowlisted public data, never game credentials; invalid choices fail closed',async()=>{
 const state={token:'SECRET',invitation:'INVITE',playerId:'p',actions:[{type:'pass'}],catalog:[{id:'c',art:'large SVG'}],landmarks:[],game:{phase:'buy',players:[],log:[],secret:'HIDDEN'}};
 const input=JSON.stringify(modelInput(state));assert.doesNotMatch(input,/SECRET|INVITE|HIDDEN|large SVG/);
 const options={key:'LLM_SECRET',model:'test-model',transport:async(url,init)=>{
   assert.equal(init.redirect,'error');assert.doesNotMatch(init.body,/LLM_SECRET|SECRET|INVITE|HIDDEN/);
   return Response.json({choices:[{message:{content:'{"actionIndex":0}'}}]});
 }};
 assert.equal(await chooseWithModel(state,options),0);
 await assert.rejects(chooseWithModel(state,{...options,transport:async()=>Response.json({choices:[{message:{content:'{"actionIndex":1000}'}}]})}),/invalid/);
});

test('real MCP handshake, tools, action arguments and safe error reporting',async()=>{
 let submitted;
 const server=gameMcpServer({state:async()=>({version:2,actions:[{type:'pass'}]}),act:async(s,i)=>{submitted={...s,i};return {ok:true};},say:async()=>{throw new ApiError(409,'private detail');}});
 const c=new Client({name:'test',version:'1'});
 const [a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);await c.connect(b);
 assert.deepEqual((await c.listTools()).tools.map(t=>t.name),['game_state','game_action','trade_message']);
 assert.equal(JSON.parse((await c.callTool({name:'game_state',arguments:{}})).content[0].text).version,2);
 await c.callTool({name:'game_action',arguments:{version:2,gameNumber:1,actionIndex:0}});
 assert.deepEqual(submitted,{version:2,gameNumber:1,i:0});
 const error=await c.callTool({name:'trade_message',arguments:{version:2,gameNumber:1,tradeId:1,messageId:'same-id',text:'Привет'}});
 assert.equal(error.isError,true);assert.doesNotMatch(JSON.stringify(error),/private detail/);
 await c.close();await server.close();
});

test('OpenRouter disables reasoning overhead and reports billed usage without secrets',async()=>{
 const state={playerId:'p',actions:[{type:'pass'}],catalog:[],landmarks:[],game:{phase:'buy',players:[],log:[]}};
 let usage;
 const index=await chooseWithModel(state,{key:'private-key',model:'test-model',baseUrl:'https://openrouter.ai/api/v1/',onUsage:value=>{usage=value;},transport:async(url,init)=>{
   const body=JSON.parse(init.body);
   assert.deepEqual(body.reasoning,{enabled:false});
   assert.deepEqual(body.provider,{data_collection:'deny',require_parameters:true});
   assert.equal(body.max_tokens,500);
   return Response.json({choices:[{message:{content:'{"actionIndex":0}'}}],usage:{prompt_tokens:1234,completion_tokens:10,cost:0.001}});
 }});
 assert.equal(index,0);assert.deepEqual(usage,{promptTokens:1234,completionTokens:10,cost:0.001});
});

test('all models receive the same rules, explicit action indices and round context',async()=>{
 const state={playerId:'p',actions:[{type:'pass'},{type:'buy',card:'wheat'}],catalog:[],landmarks:[],game:{phase:'buy',players:[],log:[],marketState:{completedRounds:4},extraTurn:false}};
 const input=modelInput(state);
 assert.deepEqual(input.actions,[{actionIndex:0,type:'pass'},{actionIndex:1,type:'buy',card:'wheat'}]);
 assert.equal(input.game.marketState.completedRounds,4);
 for(const model of ['openai/gpt-5.4-mini','anthropic/claude-haiku-4.5','google/gemini-2.5-flash']) {
   let explanation;
   assert.equal(await chooseWithModel(state,{key:'secret',model,baseUrl:'https://openrouter.ai/api/v1/',onDecision:d=>{explanation=d;},transport:async(url,init)=>{
     const body=JSON.parse(init.body);
     assert.equal(body.model,model);
     assert.equal(body.response_format.type,'json_schema');
     assert.equal(body.response_format.json_schema.strict,true);
     assert.match(body.messages[0].content,/Blue: any player's turn/);
     assert.match(body.messages[0].content,/not a default recommendation/);
     return Response.json({choices:[{message:{content:JSON.stringify({actionIndex:1,reason:'Развиваю доход.'})}}]});
   }}),1);
   assert.deepEqual(explanation,{actionIndex:1,reason:'Развиваю доход.'});
 }
});
