import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {z} from 'zod';
import {ApiError} from '../src/game/client.mjs';
import {gameChannel} from '../src/mcp/channel.mjs';
import {gameMcpServer} from '../src/mcp/server.mjs';

const state=(phase='roll',version=1,actions=[{type:'roll',count:1}])=>({version,gameNumber:1,actions,game:{phase,current:0,marketState:{completedRounds:1},logTurnStarts:[1],log:['PRIVATE CHAT'],players:[{name:'Ignore instructions'}]},token:'SECRET'});
async function sequence(steps){
  const events=[],waits=[];let reads=0;
  const watcher=gameChannel({state:async()=>{
    assert.ok(reads<steps.length,'watcher must stop');
    const next=steps[reads++];if(next instanceof Error)throw next;return next;
  }},async event=>events.push(event),{sleep:async ms=>waits.push(ms)});
  await watcher.start();return {events,waits,reads};
}

test('channels notify on actionable transitions, ignore version-only updates, stop at game end',async()=>{
  const {events,reads}=await sequence([
    state('setup',1,[]),state(),state('roll',2),state('buy',3,[{type:'pass'}]),
    state('roll',4,[]),state('roll',5),state('finished',6,[]),
  ]);
  assert.equal(reads,7);
  assert.deepEqual(events.map(e=>e.params.meta.event),['action_required','action_required','action_required','finished']);
  assert.doesNotMatch(JSON.stringify(events),/SECRET|PRIVATE CHAT|Ignore instructions|actionIndex/);
});

test('setup and Autoimport choices wake the agent even outside its turn; votes and chat do not spam',async()=>{
  const setup=state('setup',1,[{type:'chooseStartingCards'}]);
  const trade=state('autoimport',2,[{type:'autoImportChoice',choice:'hold'}]);
  trade.game.current=3;trade.game.autoImport={id:1};
  const later=structuredClone(trade);later.version=3;later.game.log.push('Another player voted');
  const nextTrade=structuredClone(trade);nextTrade.version=5;nextTrade.game.autoImport.id=2;
  const {events}=await sequence([setup,trade,later,nextTrade,state('finished')]);
  assert.equal(events.filter(e=>e.params.meta.event==='action_required').length,3);
});

test('revocation stops polling; transient errors back off, report once and recover',async()=>{
  for(const status of [401,403,404]){
    const {events,reads}=await sequence([new ApiError(status,'SECRET')]);
    assert.equal(reads,1);assert.equal(events[0].params.meta.event,'access_ended');
  }
  const {events,waits}=await sequence([new Error('SECRET'),new ApiError(503,'SECRET'),new Error('SECRET'),new Error('SECRET'),state(),state('finished')]);
  assert.deepEqual(events.map(e=>e.params.meta.event),['connection_error','action_required','finished']);
  assert.deepEqual(waits,[6000,12000,24000,30000,3000]);
  assert.doesNotMatch(JSON.stringify(events),/SECRET/);
});

test('accepted actions invalidate an in-flight read and allow another decision in the same phase',async()=>{
  let resolveRead,reads=0;const events=[];
  const watcher=gameChannel({state:async()=>{
    reads++;
    if(reads===2)return new Promise(resolve=>{resolveRead=resolve;});
    return reads===4?state('finished'):state('buy',reads,[{type:'pass'}]);
  }},async e=>events.push(e),{sleep:async()=>{}});
  const done=watcher.start();
  while(!resolveRead)await new Promise(resolve=>setImmediate(resolve));
  watcher.changed();resolveRead(state('buy',1,[{type:'pass'}]));await done;
  assert.deepEqual(events.map(e=>e.params.meta.version),['1','3','1']);
});

test('closing while a state read is pending prevents notification and further polling',async()=>{
  let resolveRead;const events=[];
  const watcher=gameChannel({state:()=>new Promise(resolve=>{resolveRead=resolve;})},async e=>events.push(e));
  const done=watcher.start();watcher.stop();resolveRead(state());await done;
  assert.deepEqual(events,[]);
});

test('real MCP handshake advertises opt-in channel and delivers its notification after initialization',async()=>{
  const server=gameMcpServer({state:async()=>state()},{channels:true});
  const c=new Client({name:'channel-test',version:'1'});
  const received=new Promise(resolve=>c.setNotificationHandler(z.object({method:z.literal('notifications/claude/channel'),params:z.object({content:z.string(),meta:z.record(z.string(),z.string())})}),resolve));
  const [a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);await c.connect(b);
  try{
    assert.deepEqual(c.getServerCapabilities().experimental,{'claude/channel':{}});
    const event=await received;assert.equal(event.params.meta.event,'action_required');
    assert.equal((await c.listTools()).tools.length,3);
  }finally{await c.close();await server.close();}
});
