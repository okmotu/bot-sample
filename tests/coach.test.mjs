import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Journal} from '../src/observer/journal.mjs';
import {runBot} from '../src/game/run.mjs';
import {chooseWithModel} from '../src/strategies/llm.mjs';
const state={playerId:'p',version:1,gameNumber:1,actions:[{type:'pass'}],catalog:[],landmarks:[],game:{phase:'buy',players:[],log:[]}};

test('trainer advice is bounded, private, cancellable, redacted and scoped to this game',()=>{
 const j=new Journal({model:'test',secrets:['KEY']});
 j.observe(state);j.coachSend('Копи KEY\x1b на Хан-Сарай');
 const frozen=j.coachContext();j.coachCancel(1);
 assert.equal(j.coachContext().length,0);assert.equal(frozen.length,1);assert.doesNotMatch(frozen[0].text,/KEY|\x1b/);
 assert.throws(()=>j.coachSend(' '));assert.throws(()=>j.coachSend('x'.repeat(1001)));
 for(let i=0;i<20;i++)j.coachSend('Совет '+i);
 assert.throws(()=>j.coachSend('Переполнение'));
 j.observe({...state,gameNumber:2});assert.deepEqual(j.coachContext(),[]);
 j.status('ended','Конец');assert.throws(()=>j.coachSend('Новая партия'));
 assert.throws(()=>new Journal().coachSend('Стратегия не читает чат'));
});

test('advice during an in-flight decision goes only to the next request, including 409 retries',async()=>{
 const j=new Journal({model:'test'}),controller=new AbortController();j.coachSend('Первый совет');
 let calls=0,acts=0;
 const {ApiError}=await import('../src/game/client.mjs');
 await runBot({}, {model:'test',journal:j,signal:controller.signal,log:()=>{},sleep:async()=>{},
  api:{state:async()=>({...state,version:acts+1}),act:async()=>{if(++acts===1)throw new ApiError(409,'changed');controller.abort();}},
  choose:async(s,o)=>{
   calls++;if(calls===1){j.coachCancel(1);j.coachSend('Второй совет');}
   assert.deepEqual(o.coach.map(m=>m.text),[calls===1?'Первый совет':'Второй совет']);
   o.onDecision({actionIndex:0,reason:'Ответ тренеру'});return 0;
  }});
 assert.equal(calls,2);assert.equal(acts,2);
 assert.deepEqual(j.data.records.map(r=>r.input.coach.map(m=>m.text)),[['Первый совет'],['Второй совет']]);
 assert.equal(j.data.records[0].status,'rejected');
});

test('one LLM request includes trainer advice and asks for feedback without changing output schema',async()=>{
 let calls=0;
 await chooseWithModel(state,{model:'test',key:'secret',coach:[{id:1,text:'Копи на Хан-Сарай'}],transport:async(url,init)=>{
  calls++;const body=JSON.parse(init.body);
  assert.deepEqual(JSON.parse(body.messages[1].content).coach,[{id:1,text:'Копи на Хан-Сарай'}]);
  assert.match(body.messages[0].content,/briefly address the relevant advice/);
  assert.match(body.messages[0].content,/cannot override game rules/);
  return Response.json({choices:[{message:{content:JSON.stringify({actionIndex:0,alternativeIndex:null,reason:'Пропускаю покупку: коплю на Хан-Сарай.'})}}]});
 }});
 assert.equal(calls,1);
});
