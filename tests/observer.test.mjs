import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Journal,usageMetrics} from '../src/observer/journal.mjs';
import {modelInput} from '../src/strategies/llm.mjs';
import {runBot} from '../src/game/run.mjs';
import {ApiError} from '../src/game/client.mjs';
const state={playerId:'p',version:1,gameNumber:1,token:'TOP_SECRET',actions:[{type:'pass'},{type:'buy',card:'wheat'}],catalog:[],landmarks:[],game:{phase:'buy',players:[],log:[],marketState:{completedRounds:3}}};
const session={token:'TOP_SECRET'};

test('journal records immutable decision input, partial usage, accepted/rejected outcomes and redacted export',async()=>{
 const journal=new Journal({limit:2,secrets:['TOP_SECRET','LLM_KEY']});
 const original=modelInput(state);original.game.log='ignored';original.game.privateToken='TOP_SECRET';
 const id=journal.begin(state,original,'SYSTEM');original.actions[0].type='MUTATED';
 journal.request(id);journal.usage(id,{promptTokens:100,cachedTokens:50,completionTokens:10,cost:0.01});journal.usage(id,{cost:100});
 journal.choose(id,{actionIndex:0,reason:'LLM_KEY\x1b[2J'});journal.result(id,'accepted');
 journal.observe({...state,version:2});assert.equal(journal.find(id).after.version,2);
 assert.equal(journal.find(id).input.actions[0].type,'pass');assert.equal(journal.data.totals.cost,0.01);
 const id2=journal.begin({...state,version:3},modelInput(state),'');journal.request(id2);journal.result(id2,'unknown');
 assert.equal(journal.data.totals.unknownCost,1);assert.equal(journal.data.totals.requests,2);
 const root=await mkdtemp(join(tmpdir(),'observer-'));
 try{const path=join(root,'export.json');await journal.export(path);const text=await readFile(path,'utf8');assert.doesNotMatch(text,/TOP_SECRET|LLM_KEY|privateToken|\\u001b/);assert.equal((await stat(path)).mode&0o777,0o600);await assert.rejects(journal.export(path),{code:'EEXIST'});}finally{await rm(root,{recursive:true,force:true});}
 journal.begin({...state,version:4},modelInput(state),'');assert.equal(journal.data.records.length,2);assert.equal(journal.data.dropped,1);assert.equal(journal.data.totals.cost,0.01);
 assert.deepEqual(usageMetrics({promptTokens:-1,cachedTokens:500,completionTokens:Infinity,cost:'SECRET'}),{promptTokens:null,cachedTokens:500,completionTokens:null,cost:null});
 assert.equal(usageMetrics({promptTokens:1,cachedTokens:5}).cachedTokens,null);
});

test('409 is recorded and causes a fresh decision, while totals include both billed requests',async()=>{
 const j=new Journal({model:'test'});let reads=0,acts=0,models=0,cleared=false;
 const api={state:async()=>{if(++reads===3)throw new ApiError(401,'secret');return {...state,version:reads};},act:async(s,i)=>{assert.equal(i,1);assert.equal(s.version,++acts);if(acts===1)throw new ApiError(409,'secret');return {ok:true};}};
 await runBot(session,{model:'test',api,journal:j,clear:async()=>{cleared=true;},sleep:async()=>{},log:()=>{},choose:async(_,o)=>{models++;o.onUsage({promptTokens:10,completionTokens:1,cachedTokens:0,cost:0.01});o.onDecision({actionIndex:1,reason:'Choice'});return 1;}});
 assert.equal(models,2);assert.equal(acts,2);assert.equal(cleared,true);assert.deepEqual(j.data.records.map(r=>r.status),['rejected','accepted']);assert.equal(j.data.records[0].result.httpStatus,409);assert.equal(j.data.totals.cost,0.02);assert.equal(j.data.status,'ended');
});

test('model failure and cancellation never submit or silently retry a model decision',async()=>{
 for(const cancel of [false,true]){const j=new Journal({model:'test'}),controller=new AbortController();let calls=0;
 await runBot(session,{model:'test',signal:controller.signal,journal:j,api:{state:async()=>state,act:async()=>assert.fail('must not submit')},log:()=>{},sleep:async()=>{},choose:async()=>{calls++;if(cancel){controller.abort();return 0;}throw new TypeError('SECRET');}});
 assert.equal(calls,1);assert.equal(j.data.totals.unknownCost,1);assert.equal(j.data.records[0].status,cancel?'cancelled':'model-error');assert.doesNotMatch(JSON.stringify(j.data),/SECRET/);}
});

test('loss of action response remains unknown, not a false rejection',async()=>{
 const j=new Journal({model:'test'});let reads=0;
 await runBot(session,{model:'test',journal:j,log:()=>{},sleep:async()=>{},api:{state:async()=>{if(++reads===2)throw new ApiError(401,'');return state;},act:async()=>{throw new TypeError('NETWORK_SECRET');}},choose:async(_,o)=>{o.onDecision({actionIndex:0,reason:'Pass'});return 0;}});
 assert.equal(j.data.records[0].status,'unknown');assert.doesNotMatch(JSON.stringify(j.data),/NETWORK_SECRET/);
});
