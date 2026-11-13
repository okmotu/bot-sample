import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {ApiError} from '../src/game/client.mjs';
const enabled=process.execArgv.includes('--experimental-ffi');
const invitation='https://okmotu.com/bot-connect#ABCDEF.'+'a'.repeat(72);
const saved={baseUrl:'https://okmotu.com',code:'ABCDEF',token:'TEST_SECRET',playerId:'bot'};
const tick=()=>new Promise(r=>setImmediate(r));
test('TUI invitation accepts paste, masks secrets, prevents duplicate exchanges and retries only persistence',{skip:!enabled},async()=>{
 const {createTestRenderer}=await import('@opentui/core/testing');
 const {promptConnection}=await import('../src/observer/connect.mjs');
 const {attachTui}=await import('../src/observer/tui.mjs');
 const {Journal}=await import('../src/observer/journal.mjs');
 const s=await createTestRenderer({width:100,height:30});let calls=0,writes=0,release;
 try{
  const completion=promptConnection(s.renderer,{exchangeInvitation:async text=>{assert.equal(text,invitation);calls++;await new Promise(r=>{release=r;});return saved;},persist:async value=>{assert.deepEqual(value,saved);if(++writes===1)throw new Error('TEST_SECRET');}});
  await s.renderOnce();await writeFile('/tmp/sample-connect.json',JSON.stringify(s.captureSpans()));
  s.mockInput.pressKey('RETURN');await s.renderOnce();assert.match(s.captureCharFrame(),/Нужна полная ссылка/);assert.equal(calls,0);
  await s.mockInput.pasteBracketedText(invitation);await s.renderOnce();assert.doesNotMatch(s.captureCharFrame(),/aaaaaa|bot-connect#ABCDEF/);
  s.mockInput.pressKey('RETURN');s.mockInput.pressKey('RETURN');await tick();assert.equal(calls,1);release();await tick();await tick();await s.renderOnce();
  assert.match(s.captureCharFrame(),/Не удалось сохранить/);assert.doesNotMatch(s.captureCharFrame(),/TEST_SECRET/);
  const lines=s.captureCharFrame().split('\n'),y=lines.findIndex(l=>l.includes(' Сохранить '));
  await s.mockMouse.click(lines[y].indexOf('Сохранить')+1,y);assert.deepEqual(await completion,saved);assert.equal(calls,1);assert.equal(writes,2);
  attachTui(s.renderer,new Journal({room:'ABCDEF'}));await s.renderOnce();assert.doesNotMatch(s.captureCharFrame(),/Ссылка-приглашение/);assert.match(s.captureCharFrame(),/0 решений/);
 }finally{s.renderer.destroy();}
});
test('invalid or expired invitation stays in form; narrow layout and cancellation do not connect',{skip:!enabled},async()=>{
 const {createTestRenderer}=await import('@opentui/core/testing');const {promptConnection}=await import('../src/observer/connect.mjs');
 const s=await createTestRenderer({width:44,height:24});let calls=0;
 try{
  const completion=promptConnection(s.renderer,{exchangeInvitation:async()=>{calls++;throw new ApiError(401,'DO_NOT_SHOW');},persist:async()=>assert.fail('no save')});
  await s.mockInput.pasteBracketedText(invitation);s.mockInput.pressKey('RETURN');await tick();await s.renderOnce();assert.match(s.captureCharFrame(),/недействительно/);assert.doesNotMatch(s.captureCharFrame(),/DO_NOT_SHOW|aaaaaa/);
  s.mockInput.pressKey('u',{ctrl:true});await s.renderOnce();assert.match(s.captureCharFrame(),/Вставьте полную/);
  s.mockInput.pressKey('ESCAPE');assert.equal(await completion,null);assert.equal(calls,1);
 }finally{s.renderer.destroy();}
});
test('cancelling in-flight exchange keeps successful session saved without reopening UI',{skip:!enabled},async()=>{
 const {createTestRenderer}=await import('@opentui/core/testing');const {promptConnection}=await import('../src/observer/connect.mjs');
 const s=await createTestRenderer({width:80,height:24});let release,writes=0;
 try{
  const completion=promptConnection(s.renderer,{exchangeInvitation:async()=>{await new Promise(r=>{release=r;});return saved;},persist:async()=>{writes++;}});
  await s.mockInput.pasteBracketedText(invitation);s.mockInput.pressKey('RETURN');await tick();s.mockInput.pressKey('ESCAPE');assert.equal(await completion,null);release();await tick();assert.equal(writes,1);
 }finally{s.renderer.destroy();}
});
