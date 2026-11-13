import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Journal} from '../src/observer/journal.mjs';
import {groupTurns,turnTitle} from '../src/observer/turns.mjs';
import {demoJournal} from '../src/observer/demo.mjs';
const base={version:1,gameNumber:1,playerId:'bot',game:{startedAt:100,phase:'roll',current:0,players:[{id:'bot',name:'SamAI'},{id:'other',name:'Соперник'}],turnTiming:{startedAt:1000},marketState:{completedRounds:2},stats:{players:{bot:{turnsCompleted:2},other:{turnsCompleted:2}}}}};
const input={actions:[],game:{players:[]}};
test('roll, reroll, trade and purchase share one server turn despite version changes',()=>{
 const j=new Journal();for(const [i,phase] of ['roll','reroll','autoimport','buy'].entries())j.begin({...base,version:i+1,game:{...base.game,phase}},input,'');
 const groups=groupTurns(j.data.records);assert.equal(groups.length,1);assert.equal(groups[0].records.length,4);assert.match(turnTitle(groups[0]),/Ход SamAI \(бот\)/);
});
test('extra turns, other actors, tournament games and setup are separate groups',()=>{
 const j=new Journal();j.begin(base,input,'');
 // Same player, same round, and even the same timestamp: completed-turn counter differs.
 const extra={...base,game:{...base.game,stats:{players:{bot:{turnsCompleted:3}}}}};j.begin(extra,input,'');
 j.begin({...extra,game:{...extra.game,current:1,phase:'autoimport'}},input,'');
 j.begin({...base,gameNumber:2},input,'');
 j.begin({...base,game:{...base.game,phase:'setup'}},input,'');
 const groups=groupTurns(j.data.records);assert.equal(groups.length,5);assert.match(turnTitle(groups[2]),/Ход Соперник/);assert.doesNotMatch(turnTitle(groups[2]),/\(бот\)/);assert.match(turnTitle(groups[4]),/Стартовые карты/);
});
test('missing turn metadata is explicit and never merges unknown turns by round',()=>{
 const j=new Journal();for(let i=0;i<2;i++)j.begin({...base,game:{...base.game,turnTiming:null,stats:undefined}},input,'');
 assert.equal(groupTurns(j.data.records).length,2);assert.match(turnTitle(groupTurns(j.data.records)[0]),/Ход не определён/);
});
test('demo pairs decisions into turns and trimming history preserves the surviving turn key',()=>{
 const j=demoJournal(),groups=groupTurns(j.data.records);assert.equal(groups.length,13);assert.ok(groups.every(g=>g.records.length===2));
 assert.equal(groupTurns(j.data.records.slice(1))[0].id,groups[0].id);
});
