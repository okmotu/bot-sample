import {BoxRenderable,TextRenderable,ScrollBoxRenderable,InputRenderable,InputRenderableEvents} from '@opentui/core';
import {resultNames} from './views.mjs';

// Private local channel. Only a frozen snapshot of active advice reaches the LLM.
export function coachPanel(renderer,journal,button){
 const panel=new BoxRenderable(renderer,{id:'coach-panel',flexDirection:'column',flexGrow:1,minHeight:0,visible:false});
 const title=new TextRenderable(renderer,{content:'Тренер · приватно · подсказки действуют до отмены\nОтвет — со следующим решением. Уже начатый запрос не меняется.',width:'100%',wrapMode:'word',flexShrink:0,fg:'#d3b775'});
 const history=new ScrollBoxRenderable(renderer,{id:'coach-history',flexGrow:1,minHeight:0,scrollY:true,stickyScroll:true,stickyStart:'bottom',contentOptions:{flexDirection:'column'}});
 const message=new TextRenderable(renderer,{id:'coach-note',width:'100%',wrapMode:'word',flexShrink:0,fg:'#98aaa7'});
 const input=new InputRenderable(renderer,{id:'coach-input',width:'100%',height:1,maxLength:1000,placeholder:'Подсказка тренера…',textColor:'#e1e4df',focusedBackgroundColor:'#293c38',onMouseDown:()=>input.focus()});
 const controls=new BoxRenderable(renderer,{flexDirection:'row',flexShrink:0,height:1});
 let notice='',signature='',opened=false;
 const send=()=>{
  try{
   journal.coachSend(input.value);input.value='';notice='Принято для следующего решения.';
   if(journal.data.demo){
    const r=journal.data.records.at(-1),snapshot=structuredClone(r.input);snapshot.coach=journal.coachContext();
    const id=journal.begin({version:r.version+1,gameNumber:r.gameNumber,game:{...snapshot.game,marketState:{completedRounds:r.round-1}}},snapshot,r.systemPrompt);
    journal.choose(id,{actionIndex:snapshot.actions[0].actionIndex,source:'model',reason:'Демонстрационный ответ: здесь бот объяснит, как учёл вашу подсказку. Реального запроса к модели не было.'});
    journal.result(id,'demo');
   }
  }catch(error){notice=error.message;}
  update();input.focus();history.scrollTo(Infinity);
 };
 controls.add(button('coach-send','Отправить',send).el);
 input.on(InputRenderableEvents.ENTER,send);
 panel.add(title);panel.add(history);panel.add(message);panel.add(input);panel.add(controls);
 function update(){
  if(!opened)return;
  const data=journal.data,records=data.records.filter(r=>r.input.coach?.length);
  message.content=!data.model?'Подсказки требуют LLM_MODEL. JavaScript-стратегия их не читает.':notice||(data.demo?'Демо: ответы вымышлены, платных запросов нет.':'Enter — отправить · Esc — вернуться в ленту');
  const next=JSON.stringify([data.coach,records.map(r=>[r.id,r.status,r.selection?.reason]),data.status]);
  if(signature===next)return;signature=next;
  const bottom=history.scrollTop>=history.scrollHeight-history.viewport.height-1;
  for(const child of history.getChildren()){history.remove(child);child.destroyRecursively();}
  const entries=[...data.coach.map(m=>({at:m.at,kind:'coach',m})),...records.map(r=>({at:r.at,kind:'reply',r}))].sort((a,b)=>a.at-b.at);
  if(!entries.length)history.add(new TextRenderable(renderer,{content:'Например: «Не развивай больше экономику. Копи на Хан-Сарай».',wrapMode:'word',width:'100%',flexShrink:0,fg:'#98aaa7'}));
  for(const entry of entries){
   const box=new BoxRenderable(renderer,{flexDirection:'column',width:'100%',flexShrink:0,paddingBottom:1});
   if(entry.kind==='coach'){
    const m=entry.m,seen=records.filter(r=>r.input.coach.some(c=>c.id===m.id));
    const state=m.cancelled?'Отменена для следующих решений':seen.length?`Передана в решение #${seen.at(-1).id} · действует`:'Ожидает следующего решения';
    box.add(new TextRenderable(renderer,{content:`Вы · ${m.id}\n${m.text}\n${state}`,wrapMode:'word',width:'100%',flexShrink:0,fg:m.cancelled?'#98aaa7':'#e1e4df'}));
    if(!m.cancelled)box.add(button(`coach-cancel-${m.id}`,'Отменить',()=>{journal.coachCancel(m.id);input.focus();}).el);
   }else{
    const r=entry.r;
    box.add(new TextRenderable(renderer,{content:`Бот · решение #${r.id} · ${r.status==='demo'?'демо':resultNames[r.status]||r.status}\n${r.selection?.reason||'Ожидаем ответ модели…'}\nПодсказки: ${r.input.coach.map(m=>m.id).join(', ')}`,wrapMode:'word',width:'100%',flexShrink:0,fg:'#b3c5a4'}));
   }
   history.add(box);
  }
  if(bottom)history.scrollTo(Infinity);
 }
 return {panel,update,setOpen(value){opened=value;panel.visible=value;if(value){update();input.focus();}else input.blur();},scroll:delta=>history.scrollBy(delta,'viewport')};
}
