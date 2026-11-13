import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicMetadata,syncMetadata} from '../src/game/metadata.mjs';
import {exchange,client,ApiError} from '../src/game/client.mjs';
import {runBot} from '../src/game/run.mjs';

test('public labels have explicit defaults, overrides and opt-out; secrets are not inferred',()=>{
 assert.deepEqual(publicMetadata({}),{harness:'bot-sample',model:null});
 assert.deepEqual(publicMetadata({LLM_MODEL:'provider/model',LLM_API_KEY:'secret',LLM_BASE_URL:'private-url'}),{harness:'bot-sample',model:'provider/model'});
 assert.deepEqual(publicMetadata({BOT_HARNESS:' my-bot ',BOT_MODEL:'custom',LLM_MODEL:'other'}),{harness:'my-bot',model:'custom'});
 assert.deepEqual(publicMetadata({BOT_MODEL:'',BOT_HARNESS:'',LLM_MODEL:'other'}),{harness:null,model:null});
 assert.deepEqual(publicMetadata({BOT_METADATA:'false',BOT_HARNESS:'my-bot',LLM_MODEL:'other'}),{harness:null,model:null});
 assert.equal(publicMetadata({LLM_MODEL:'irrelevant'},null).model,null);
});

test('exchange and metadata PATCH send only allowlisted labels and keep credentials out of URLs',async()=>{
 const calls=[];
 const transport=async(url,options)=>{calls.push({url,...options});return Response.json({token:'test-secret',playerId:'p'});};
 const labels={harness:'bot-sample',model:'provider/model',LLM_API_KEY:'never-send',token:'never-send'};
 const invitation='http://localhost:5177/bot-connect#ABCDEF.'+'a'.repeat(72);
 const session=await exchange(invitation,transport,labels);
 assert.deepEqual(JSON.parse(calls[0].body),{invite:'a'.repeat(72),harness:labels.harness,model:labels.model});
 await client(session,transport).updateMetadata({version:7,gameNumber:2},labels);
 assert.equal(calls[1].method,'PATCH');
 assert.equal(calls[1].headers.Authorization,'Bearer test-secret');
 assert.deepEqual(JSON.parse(calls[1].body),{version:7,gameNumber:2,harness:labels.harness,model:labels.model});
 assert.equal(calls[1].redirect,'error');
 assert.ok(!JSON.stringify(calls).includes('never-send'));
 assert.ok(calls.every(c=>!c.url.includes('test-secret')));
});

test('synchronization handles old servers, no-op and removal, and re-reads after changing version',async()=>{
 const desired=publicMetadata({});let writes=0,reads=0;
 const api={updateMetadata:async(s,m)=>{writes++;assert.equal(s.version,3);assert.deepEqual(m,{harness:null,model:null});},state:async()=>{reads++;return {version:4,botMetadata:{},actions:['fresh']};}};
 const old={version:1};assert.equal(await syncMetadata(api,old,desired),old);
 const same={version:2,botMetadata:{harness:'bot-sample'}};assert.equal(await syncMetadata(api,same,desired),same);
 assert.equal(writes,0);assert.equal(reads,0);
 const result=await syncMetadata(api,{version:3,botMetadata:{harness:'bot-sample',model:'old'}},publicMetadata({BOT_METADATA:'false'}));
 assert.equal(writes,1);assert.equal(reads,1);assert.equal(result.version,4);assert.deepEqual(result.actions,['fresh']);
});

test('metadata CAS conflicts are re-read before choosing; decisions use the updated version',async()=>{
 let version=1,patches=0,chosen=0,acted=0;
 const controller=new AbortController();
 const api={
  state:async()=>({version,gameNumber:1,botMetadata:patches<2?{}:publicMetadata(process.env,'test-model'),game:{phase:'buy',players:[],log:[]},catalog:[],landmarks:[],actions:[{type:'pass'}]}),
  updateMetadata:async(s,m)=>{assert.equal(s.version,version);assert.deepEqual(m,publicMetadata(process.env,'test-model'));version++;if(++patches===1)throw new ApiError(409,'conflict');},
  act:async(s)=>{assert.equal(s.version,3);acted++;controller.abort();},
 };
 await runBot({}, {api,model:'test-model',signal:controller.signal,choose:async(s)=>{assert.equal(s.version,3);chosen++;return 0;},log:()=>{},sleep:async()=>{}});
 assert.equal(patches,2);assert.equal(chosen,1);assert.equal(acted,1);
});
