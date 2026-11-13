import {setTimeout as delay} from 'node:timers/promises';
import {ApiError,client} from './client.mjs';
import {chooseAction} from '../strategies/baseline.mjs';
import {chooseWithModel,modelInput} from '../strategies/llm.mjs';
import {SYSTEM_PROMPT} from '../prompts/system.mjs';
import {publicMetadata,syncMetadata} from './metadata.mjs';

// Game loop is independent of the terminal UI; the observer never chooses actions.
export async function runBot(session,{api=client(session),model=process.env.LLM_MODEL,journal,signal,log=console.log,clear=async()=>{},sleep=()=>delay(2000,undefined,{signal}),choose=chooseWithModel}={}){
 let failures=0;
 const metadata=publicMetadata(process.env,model);
 journal?.status('waiting','Ожидаем хода или запуска партии');
 for(;;){
  if(signal?.aborted){journal?.status('stopped','Бот остановлен');return;}
  let id;
  try{
   let state=await api.state();if(signal?.aborted)return;
   state=await syncMetadata(api,state,metadata);if(signal?.aborted)return;
   journal?.observe(state);
   if(state.game?.phase==='finished'){journal?.status('ended','Партия завершена');return;}
   if(state.actions.length){
    journal?.status('running',model?'Модель выбирает действие…':'Стратегия выбирает действие…');
    id=journal?.begin(state,modelInput(state),model?SYSTEM_PROMPT:'');
    let actionIndex;
    if(model){
     journal?.request(id);
     try{actionIndex=await choose(state,{model,signal,onUsage:u=>journal?.usage(id,u),onDecision:d=>journal?.choose(id,d)});}
     catch{journal?.result(id,signal?.aborted?'cancelled':'model-error');journal?.status(signal?.aborted?'stopped':'error',signal?.aborted?'Бот остановлен':'Ошибка модели. Повторного запроса не было.');return 'model-error';}
    }else{actionIndex=chooseAction(state);journal?.choose(id,{actionIndex,reason:null,source:'strategy'});}
    if(signal?.aborted){journal?.result(id,'cancelled');return;}
    if(!Number.isInteger(actionIndex)||!state.actions[actionIndex])throw new Error('Invalid action');
    await api.act(state,actionIndex);
    journal?.result(id,'accepted');journal?.status('waiting','Ход принят. Ожидаем следующего решения.');
    log(`Партия ${state.gameNumber}: ${state.actions[actionIndex].type}`);
   }
   failures=0;
  }catch(error){
   if(id!==undefined)journal?.result(id,error instanceof ApiError&&error.status<500?'rejected':'unknown',{httpStatus:error instanceof ApiError?error.status:null});
   if(error instanceof ApiError&&[401,404].includes(error.status)){
    await clear();journal?.status('ended','Доступ завершён: партия окончена или управление отозвано.');log('Доступ завершён: партия закончилась, место удалено или управление возвращено человеку. Для новой партии нужно новое приглашение.');return;
   }
   if(error instanceof ApiError&&error.status===409)continue;
   if(!(error instanceof ApiError)&&!['TimeoutError','TypeError'].includes(error.name)){journal?.status('error','Бот остановлен из-за ошибки действия');return 'error';}
   if(++failures>=5){journal?.status('error','Нет связи с игрой после 5 попыток. Сессия сохранена.');return 'error';}
   log('Нет ответа от игры. Повторим подключение.');
  }
  try{await sleep();}catch{if(signal?.aborted)return;throw new Error('Wait failed');}
 }
}
