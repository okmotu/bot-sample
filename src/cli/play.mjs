import {readSession,clearSession} from '../game/session.mjs';
import {runBot} from '../game/run.mjs';
import {client,ApiError} from '../game/client.mjs';
import {publicMetadata,syncMetadata} from '../game/metadata.mjs';
import {Journal} from '../observer/journal.mjs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

async function main(){
 const demo=process.argv.includes('--demo'),connectOnly=process.argv.includes('--connect-only');
 if(demo&&connectOnly)throw new Error('Choose demo or connection setup.');
 if(!process.stdin.isTTY||!process.stdout.isTTY){console.error('Запустите npm start в интерактивном терминале. Для внешнего агента используйте npm run mcp.');process.exitCode=1;return;}
 // Load the UI before consuming a one-time invitation.
 const ui=await import('../observer/tui.mjs');
 const controller=new AbortController();let renderer;
 try{
  let session=demo?null:await readSession();
  if(connectOnly&&session){
   try{await client(session).state();}
   catch(error){if(!(error instanceof ApiError)||![401,404].includes(error.status))throw error;await clearSession();session=null;}
  }
  if(!demo&&!session){
   renderer=await ui.createTuiRenderer();
   session=await (await import('../observer/connect.mjs')).promptConnection(renderer);
   if(!session)return;
  }
  if(connectOnly){
   const api=client(session);
   await syncMetadata(api,await api.state(),publicMetadata(process.env,null));
   renderer?.destroy();renderer=null;
   console.log('Подключение сохранено. Теперь можно запускать MCP-агента.');
   return;
  }
  const journal=demo?(await import('../observer/demo.mjs')).demoJournal():new Journal({model:process.env.LLM_MODEL||null,room:session.code,secrets:[session.token,process.env.LLM_API_KEY]});
  const options={onQuit:()=>controller.abort(),onExport:async()=>{const path=resolve(`bot-decisions-${Date.now()}-${randomUUID().slice(0,8)}.json`);await journal.export(path);return path;}};
  if(renderer)ui.attachTui(renderer,journal,{...options,onQuit:()=>{controller.abort();renderer.destroy();}});
  else renderer=await ui.openTui(journal,options);
  const closed=new Promise(resolve=>renderer.once('destroy',()=>{controller.abort();resolve();}));
  if(!demo){const result=await runBot(session,{journal,signal:controller.signal,clear:clearSession,log:()=>{}});if(result&&!controller.signal.aborted)process.exitCode=1;}
  await closed;
 }finally{renderer?.destroy();}
}
main().catch(()=>{console.error('Бот остановлен. Проверьте окружение, сервер и приглашение. Нужны Node.js 26.4+, зависимости и запуск через npm start. Секреты в журнал не выводятся.');process.exitCode=1;});
