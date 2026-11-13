import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

async function fixture(run){
 const root=await mkdtemp(join(tmpdir(),'sample-start-test-'));
 try{
  await cp(new URL('../src/',import.meta.url),join(root,'src'),{recursive:true});
  // The entrypoint is real; terminal widgets and the game loop have isolated fakes.
  await writeFile(join(root,'src/observer/tui.mjs'),`
   import {EventEmitter} from 'node:events';
   export function createTuiRenderer(){const r=new EventEmitter();r.destroy=()=>{if(!r.done){r.done=true;r.emit('destroy');}};return r;}
   export function attachTui(r,journal,options){console.log('FEED');setImmediate(()=>{options.onQuit?.();r.destroy();});}
   export async function openTui(journal,options){const r=createTuiRenderer();attachTui(r,journal,options);return r;}
  `);
  await writeFile(join(root,'src/observer/connect.mjs'),`
   import {saveSession} from '../game/session.mjs';
   export async function promptConnection(){console.log('FORM');const s={baseUrl:'http://localhost',code:'ABCDEF',token:'TEST_SECRET',playerId:'p'};await saveSession(s);return s;}
  `);
  await writeFile(join(root,'src/game/run.mjs'),`export async function runBot(s,{journal}){if(!journal)throw new Error('Missing journal');console.log('RUN');}`);
  const bootstrap=join(root,'bootstrap.mjs');
  await writeFile(bootstrap,`
   if(process.env.TEST_TTY==='1'){Object.defineProperty(process.stdin,'isTTY',{value:true});Object.defineProperty(process.stdout,'isTTY',{value:true});}
   globalThis.fetch=async(url,options)=>{if(options.method!=='GET')throw new Error('Unexpected mutation');return Response.json({version:1,gameNumber:1,actions:[],game:null});};
  `);
  const launch=(args=[],tty=true)=>spawnSync(process.execPath,['--import',bootstrap,join(root,'src/cli/play.mjs'),...args],{encoding:'utf8',timeout:5000,env:{...process.env,TEST_TTY:tty?'1':'0'}});
  await run({root,launch});
 }finally{await rm(root,{recursive:true,force:true});}
}

for(const saved of [false,true])test(`npm start always opens TUI; existing session: ${saved}`,()=>fixture(async({root,launch})=>{
 if(saved)await writeFile(join(root,'.aiyl-session.json'),JSON.stringify({baseUrl:'http://localhost',code:'ABCDEF',token:'TEST_SECRET'}));
 const r=launch();assert.ifError(r.error);assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/FEED/);assert.match(r.stdout,/RUN/);
 if(saved)assert.doesNotMatch(r.stdout,/FORM/);else assert.match(r.stdout,/FORM/);
 assert.doesNotMatch(r.stdout+r.stderr,/TEST_SECRET/);
}));

test('connection-only uses the TUI form and saves session without starting play',()=>fixture(async({root,launch})=>{
 const r=launch(['--connect-only']);assert.ifError(r.error);assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/FORM/);assert.doesNotMatch(r.stdout,/RUN|FEED|TEST_SECRET/);
 assert.equal(JSON.parse(await readFile(join(root,'.aiyl-session.json'),'utf8')).code,'ABCDEF');
}));

test('demo needs neither an invitation nor a game loop',()=>fixture(async({launch})=>{
 const r=launch(['--demo']);assert.ifError(r.error);assert.equal(r.status,0,r.stderr);
 assert.match(r.stdout,/FEED/);assert.doesNotMatch(r.stdout,/FORM|RUN/);
}));

test('non-interactive startup fails before reading credentials or opening UI',()=>fixture(async({root,launch})=>{
 await writeFile(join(root,'.aiyl-session.json'),'invalid JSON with TEST_SECRET');
 const r=launch([],false);assert.ifError(r.error);assert.equal(r.status,1);
 assert.match(r.stderr,/интерактивном терминале/);assert.doesNotMatch(r.stdout+r.stderr,/TEST_SECRET|FORM|RUN|FEED/);
}));
