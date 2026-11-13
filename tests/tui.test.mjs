import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const enabled=process.execArgv.includes('--experimental-ffi');
test('event feed expands historical snapshots by mouse, preserves panels and supports keyboard and narrow screens',{skip:!enabled},async()=>{
 const {createTestRenderer}=await import('@opentui/core/testing');
 const {attachTui}=await import('../src/observer/tui.mjs');
 const {demoJournal}=await import('../src/observer/demo.mjs');
 const setup=await createTestRenderer({width:110,height:40});let quit=false,exports=0;
 const shot=async name=>writeFile(`/tmp/sample-feed-${name}.json`,JSON.stringify(setup.captureSpans()));
 try{
  const journal=demoJournal();attachTui(setup.renderer,journal,{onQuit:()=>{quit=true;},onExport:async()=>{exports++;return '/tmp/demo.json';}});
  await setup.renderOnce();await setup.renderOnce();assert.match(setup.captureCharFrame(),/#26/);await shot('tail');
  setup.mockInput.pressKey('HOME');await setup.renderOnce();assert.match(setup.captureCharFrame(),/#1 · Строительство/);assert.match(setup.captureCharFrame(),/Альтернатива: Купить · Мал/);assert.match(setup.captureCharFrame(),/Ход принят · Модель/);assert.doesNotMatch(setup.captureCharFrame(),/План/);await shot('start');
  async function click(label,button=0){const lines=setup.captureCharFrame().split('\n');const y=lines.findIndex(l=>l.includes(label));assert.ok(y>=0,label+'\n'+setup.captureCharFrame());await setup.mockMouse.click(lines[y].indexOf(label)+1,y,button);await setup.renderOnce();}
  assert.match(setup.captureCharFrame(),/Раунд 8 · Ход Бот-пример \(бот\).*Решений: 2/);
  await click('Раунд 8 · Ход');assert.doesNotMatch(setup.captureCharFrame(),/#1 · Строительство/);
  await click('Раунд 8 · Ход');assert.match(setup.captureCharFrame(),/#1 · Строительство/);
  setup.mockInput.pressKey(' ');await setup.renderOnce();assert.doesNotMatch(setup.captureCharFrame(),/#1 · Строительство/);
  setup.mockInput.pressKey(' ');await setup.renderOnce();assert.match(setup.captureCharFrame(),/#1 · Строительство/);
  await click('2 Рынок');assert.match(setup.captureCharFrame(),/Снимок до решения #1/);assert.match(setup.captureCharFrame(),/Рынок: 12 видов/);await shot('market');
  await click('1 Стол',2);assert.match(setup.captureCharFrame(),/Рынок: 12 видов/);
  await click('1 Стол');let frame=setup.captureCharFrame();for(const name of ['Бот-пример','Айжан','Дастан','Тико','Аза','Dima'])assert.ok(frame.includes(name),name);await shot('table');
  await click('1 Стол');assert.doesNotMatch(setup.captureCharFrame(),/Снимок до решения/);
  setup.mockInput.pressArrow('down');await setup.renderOnce();assert.match(setup.captureCharFrame(),/HTTP 409/);
  setup.mockInput.pressArrow('up');setup.mockInput.pressKey('3');await setup.renderOnce();await click('Вход JSON');assert.match(setup.captureCharFrame(),/"playerId"/);
  setup.mockInput.pressKey('e');await new Promise(resolve=>setImmediate(resolve));await setup.renderOnce();assert.equal(exports,1);
  // Reading an old decision must not jump when a new one is appended.
  const r=journal.data.records.at(-1);const id=journal.begin({version:99,gameNumber:1,game:{phase:'buy',marketState:{completedRounds:21}}},r.input,r.systemPrompt);
  journal.choose(id,{actionIndex:0,reason:'Новый пример'});journal.result(id,'accepted');await setup.renderOnce();
  assert.match(setup.captureCharFrame(),/новых решений/);assert.match(setup.captureCharFrame(),/"playerId"/);
  setup.mockInput.pressKey('f');await setup.renderOnce();assert.match(setup.captureCharFrame(),/#27/);
  setup.resize(68,26);setup.mockInput.pressKey('HOME');await setup.renderOnce();await click('2 Рынок');assert.match(setup.captureCharFrame(),/Снимок до решения #1/);await shot('narrow');
  setup.mockInput.pressKey('\x1b[6~');await setup.renderOnce();assert.match(setup.captureCharFrame(),/Антимонополия/);
  setup.mockInput.pressKey('q');assert.equal(quit,true);
 }finally{setup.renderer.destroy();}
});
