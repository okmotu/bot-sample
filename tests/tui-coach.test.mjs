import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const enabled=process.execArgv.includes('--experimental-ffi');
test('trainer chat supports mouse, paste, cancellation, demo replies and narrow terminals without triggering feed shortcuts',{skip:!enabled},async()=>{
 const {createTestRenderer}=await import('@opentui/core/testing');
 const {attachTui}=await import('../src/observer/tui.mjs');
 const {demoJournal}=await import('../src/observer/demo.mjs');
 const setup=await createTestRenderer({width:100,height:32});let quit=false,exports=0;
 try{
  const j=demoJournal();attachTui(setup.renderer,j,{onQuit:()=>{quit=true;},onExport:()=>{exports++;}});
  const render=async()=>{await setup.renderOnce();await setup.renderOnce();};
  const click=async label=>{const lines=setup.captureCharFrame().split('\n'),y=lines.findIndex(l=>l.includes(label));assert.ok(y>=0,label+'\n'+setup.captureCharFrame());await setup.mockMouse.click(lines[y].indexOf(label)+1,y);await render();};
  await render();await click('c Тренер');
  await setup.mockInput.typeText('qef123');await render();assert.equal(quit,false);assert.equal(exports,0);
  setup.mockInput.pressKey('RETURN');await render();assert.equal(j.data.coach[0].text,'qef123');assert.ok(j.data.records.at(-1).input.coach,setup.captureCharFrame());assert.equal(j.data.records.at(-1).input.coach[0].text,'qef123');
  assert.match(setup.captureCharFrame(),/Демонстрационный ответ/);
  await click('Отменить');assert.deepEqual(j.coachContext(),[]);assert.equal(j.data.records.at(-1).input.coach[0].text,'qef123');
  await setup.mockInput.pasteBracketedText('Копи на Хан-Сарай');setup.mockInput.pressKey('RETURN');await render();
  assert.equal(j.coachContext()[0].text,'Копи на Хан-Сарай');
  setup.resize(68,26);await render();assert.match(setup.captureCharFrame(),/Тренер · приватно/);assert.match(setup.captureCharFrame(),/Отправить/);
  await writeFile('/tmp/sample-coach-narrow.json',JSON.stringify(setup.captureSpans()));
  setup.mockInput.pressKey('ESCAPE');await new Promise(r=>setTimeout(r,60));await render();assert.match(setup.captureCharFrame(),/Тренер: #2/);setup.mockInput.pressKey('4');await render();assert.match(setup.captureCharFrame(),/\[2\] Копи на Хан-Сарай/);
  setup.mockInput.pressKey('c');setup.mockInput.pressKey('\x1b[5~');await render();assert.match(setup.captureCharFrame(),/Отменена для следующих решений/);
  setup.resize(110,40);await render();await writeFile('/tmp/sample-coach-wide.json',JSON.stringify(setup.captureSpans()));
  setup.mockInput.pressKey('ESCAPE');await new Promise(r=>setTimeout(r,60));setup.mockInput.pressKey('q');assert.equal(quit,true);
 }finally{setup.renderer.destroy();}
});
