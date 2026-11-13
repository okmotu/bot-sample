import {BoxRenderable,TextRenderable,ScrollBoxRenderable,createCliRenderer,StyledText,fg} from '@opentui/core';
import {groupTurns,turnTitle} from './turns.mjs';
import {viewContent,actionLabel,resultNames,phaseName,cardColors} from './views.mjs';

const rich=spans=>new StyledText(spans.map(c=>fg(c.color||'#e1e4df')(c.text)));
const parts=[['table','Стол'],['market','Рынок'],['debug','Отладка']];
const debugParts=[['actions','Действия'],['input','Вход JSON'],['prompt','Промпт'],['usage','Расход']];
export function attachTui(renderer,journal,{onQuit=()=>renderer.destroy(),onExport=async()=>''}={}){
 let selected=journal.data.records.at(-1)?.id,note='',exporting=false,unread=0,first=true;
 const nodes=new Map(),groups=new Map();
 const root=new BoxRenderable(renderer,{id:'observer',width:'100%',height:'100%',flexDirection:'column',backgroundColor:'#151c22'});
 const header=new TextRenderable(renderer,{id:'heading',height:2,fg:'#cbd3d7',wrapMode:'word',flexShrink:0});
 const feed=new ScrollBoxRenderable(renderer,{id:'feed',flexGrow:1,minHeight:0,width:'100%',scrollY:true,stickyScroll:true,stickyStart:'bottom',contentOptions:{flexDirection:'column'}});
 const footer=new TextRenderable(renderer,{id:'footer',height:2,fg:'#93a0a6',wrapMode:'word',flexShrink:0});
 root.add(header);root.add(feed);
 function button(id,title,run){
  let armed=false,hover=false,active=false;
  const el=new TextRenderable(renderer,{id,width:title.length+4,height:1,flexShrink:0,selectable:false,
   onMouseDown:e=>{armed=e.button===0;e.preventDefault();},
   onMouseUp:e=>{if(e.button===0&&armed){armed=false;run();}},
   onMouseOver:()=>{hover=true;paint();},onMouseOut:()=>{hover=false;armed=false;paint();}});
  function paint(){el.content=active?`[${title}]  `:` ${title}   `;el.fg=active?'#151c22':'#d3b775';el.bg=active?'#d3b775':hover?'#34433e':'#151c22';}
  paint();return {el,width:title.length+4,setActive:value=>{active=value;paint();}};
 }
 const newest=button('latest','↓ К последнему',()=>goLast());root.add(newest.el);root.add(footer);renderer.root.add(root);
 const rows=buttons=>{let n=1,x=0;for(const b of buttons){if(x&&x+b.width>renderer.width-4){n++;x=0;}x+=b.width;}return n;};
 function select(id){selected=id;for(const [key,node] of nodes)node.box.backgroundColor=key===id?'#202e2b':'#151c22';}
 function goLast(){select(journal.data.records.at(-1)?.id);const node=nodes.get(selected);if(node){node.group.collapsed=false;paintGroup(node.group);}unread=0;feed.scrollTo(Infinity);updateHeader();}
 function updateHeader(){
  const s=journal.data,t=s.totals;
  const text=`${s.demo?'ДЕМО · ':''}BOT SAMPLE · ${s.room||'локально'} · ${s.model||'JavaScript'}\n${s.records.length} решений · ${t.requests} запросов · $${t.cost.toFixed(4)}${t.unknownCost?' + неизвестная стоимость':''} · ${s.message}`;
  header.content=text;header.height=text.split('\n').reduce((n,l)=>n+Math.max(1,Math.ceil(l.length/Math.max(1,renderer.width))),0);
  newest.el.content=unread?` ↓ ${unread} новых решений · f `:' ↓ К последнему · f ';newest.el.width=unread?34:22;
  footer.content=note||'↑↓ решение · Space свернуть ход · Home/End · колесо\n1 Стол · 2 Рынок · 3 Отладка · d раздел · e экспорт · q выход';
  footer.height=renderer.width<70?3:2;
 }
 function toggle(node,kind){
  const release=feed.anchor(node.box);select(node.id);node.open=node.open===kind?null:kind;note='';paint(node);feed.afterLayout(release);updateHeader();
 }
 function paintGroup(group){
  group.heading.content=turnTitle(group.data,group.collapsed);group.body.visible=!group.collapsed;
 }
 function toggleGroup(group){
  const release=feed.anchor(group.box);group.collapsed=!group.collapsed;paintGroup(group);feed.afterLayout(release);
 }
 function createGroup(data){
  const group={data,collapsed:false};
  group.box=new BoxRenderable(renderer,{id:`turn-${data.records[0].id}`,width:'100%',flexDirection:'column',flexShrink:0,border:true,borderColor:'#536361'});
  let armed=false;
  group.heading=new TextRenderable(renderer,{id:`turn-heading-${data.records[0].id}`,width:'100%',wrapMode:'word',flexShrink:0,fg:'#d3b775',selectable:false,
   onMouseDown:e=>{armed=e.button===0;e.preventDefault();},onMouseOut:()=>{armed=false;},onMouseUp:e=>{if(e.button===0&&armed){armed=false;toggleGroup(group);}}});
  group.body=new BoxRenderable(renderer,{id:`turn-body-${data.records[0].id}`,width:'100%',flexDirection:'column',flexShrink:0});
  group.box.add(group.heading);group.box.add(group.body);feed.add(group.box);groups.set(data.id,group);return group;
 }
 function create(record,group){
  const node={id:record.id,record,group,open:null,debug:'actions'};
  node.box=new BoxRenderable(renderer,{id:`event-${node.id}`,width:'100%',flexDirection:'column',flexShrink:0,paddingTop:1});
  node.summary=new TextRenderable(renderer,{id:`summary-${node.id}`,width:'100%',wrapMode:'word',flexShrink:0,onMouseDown:e=>{if(e.button===0)select(node.id);}});
  node.controls=new BoxRenderable(renderer,{id:`controls-${node.id}`,flexDirection:'row',flexWrap:'wrap',flexShrink:0});
  node.buttons=parts.map(([kind,title],i)=>button(`event-${node.id}-${kind}`,`${i+1} ${title}`,()=>toggle(node,kind)));
  for(const b of node.buttons)node.controls.add(b.el);
  node.panel=new BoxRenderable(renderer,{id:`panel-${node.id}`,flexDirection:'column',width:'100%',flexShrink:0,visible:false});
  node.debugrow=new BoxRenderable(renderer,{id:`debug-${node.id}`,flexDirection:'row',flexWrap:'wrap',flexShrink:0});
  node.debugButtons=debugParts.map(([kind,title])=>button(`debug-${node.id}-${kind}`,title,()=>{select(node.id);node.debug=kind;paint(node);}));
  for(const b of node.debugButtons)node.debugrow.add(b.el);
  node.detail=new TextRenderable(renderer,{id:`detail-${node.id}`,width:'100%',wrapMode:'word',flexShrink:0});
  node.panel.add(node.debugrow);node.panel.add(node.detail);
  node.box.add(node.summary);node.box.add(node.controls);node.box.add(node.panel);group.body.add(node.box);nodes.set(node.id,node);return node;
 }
 function paint(node){
  const r=node.record,a=r.selection?.action,c=r.input.catalog.find(c=>c.id===(a?.card?.id||a?.card));
  const mode=r.source==='model'?'Модель':r.source==='strategy'?'JavaScript-стратегия':r.requested?'Модель':'Источник пока не определён';
  const spans=[{text:`#${r.id} · ${phaseName(r.phase)} · `,color:'#98aaa7'},{text:actionLabel(a,r.input)+'\n',color:cardColors[c?.color]||'#e6c671'},
   {text:(r.selection?.reason||(r.selection?'Стратегия не предоставила объяснение.':'Ожидаем решение…'))+'\n'}];
  if(r.selection?.alternative)spans.push({text:`Альтернатива: ${actionLabel(r.selection.alternative,r.input)}\n`,color:'#b3c5a4'});
  spans.push({text:`${resultNames[r.status]||r.status}${r.result?.httpStatus?' · HTTP '+r.result.httpStatus:''} · ${mode}${r.requested?' · '+(r.usage?.cost==null?'стоимость н/д':'$'+r.usage.cost.toFixed(4)):''}`,color:['rejected','unknown','model-error'].includes(r.status)?'#ff9586':'#98aaa7'});
  node.summary.content=rich(spans);node.controls.height=rows(node.buttons);
  node.buttons.forEach((b,i)=>b.setActive(node.open===parts[i][0]));
  node.panel.visible=!!node.open;node.debugrow.visible=node.open==='debug';node.debugrow.height=rows(node.debugButtons);
  node.debugButtons.forEach((b,i)=>b.setActive(node.debug===debugParts[i][0]));
  if(node.open){
   const usage=node.open==='debug'&&node.debug==='usage';
   node.detail.content=usage?`Расход решения #${r.id}\n${r.requested?'Вход '+(r.usage?.promptTokens??'н/д')+' · кеш '+(r.usage?.cachedTokens??'н/д')+' · выход '+(r.usage?.completionTokens??'н/д'):'Запроса к модели не было.'}\n${r.result?'Время: '+((r.result.at-r.at)/1000).toFixed(1)+' с':''}\nОбъяснение — ответ модели, а не её внутренний ход мыслей.`:rich(viewContent(r,node.open,{debug:node.debug,width:Math.max(1,renderer.width-4)}));
  }
  node.box.backgroundColor=node.id===selected?'#202e2b':'#151c22';
 }
 function update(){
  const bottom=feed.scrollTop>=feed.scrollHeight-feed.viewport.height-1;
  const records=journal.data.records;let added=0;
  const grouped=groupTurns(records);
  for(const data of grouped){
   const group=groups.get(data.id)||createGroup(data);group.data=data;
   for(const r of data.records){let node=nodes.get(r.id);if(!node){node=create(r,group);added++;}else if(node.group!==group){node.group.body.remove(node.box);group.body.add(node.box);node.group=group;}node.record=r;paint(node);}
   paintGroup(group);
  }
  const ids=new Set(records.map(r=>r.id));for(const [id,node] of nodes)if(!ids.has(id)){node.group.body.remove(node.box);node.box.destroyRecursively();nodes.delete(id);}
  const groupIds=new Set(grouped.map(g=>g.id));for(const [id,group] of groups)if(!groupIds.has(id)){feed.remove(group.box);group.box.destroyRecursively();groups.delete(id);}
  if(!ids.has(selected))selected=records.at(-1)?.id;
  if(first||bottom){select(records.at(-1)?.id);unread=0;if(first||added)feed.scrollTo(Infinity);}else unread+=added;
  first=false;updateHeader();
 }
 const key=async k=>{
  const records=journal.data.records,index=records.findIndex(r=>r.id===selected);
  if(k.name==='q'||k.name==='c'&&k.ctrl){onQuit();return;}
  if(k.name==='up'||k.name==='down'){
   select(records[Math.max(0,Math.min(records.length-1,index+(k.name==='up'?-1:1)))]?.id);
   const node=nodes.get(selected);if(node){node.group.collapsed=false;paintGroup(node.group);feed.scrollChildIntoView(node.box,{align:'start'});}
  }else if(k.name==='home'){select(records[0]?.id);const node=nodes.get(selected);if(node){node.group.collapsed=false;paintGroup(node.group);}feed.scrollTo(0);}
  else if(k.name==='space'){const node=nodes.get(selected);if(node)toggleGroup(node.group);}
  else if(k.name==='end'||k.name==='f'){goLast();}
  else if(k.name==='pageup'||k.name==='pagedown')feed.scrollBy(k.name==='pageup'?-1:1,'viewport');
  else if(/^[1-3]$/.test(k.name)){const node=nodes.get(selected);if(node)toggle(node,parts[Number(k.name)-1][0]);}
  else if(k.name==='d'){const node=nodes.get(selected);if(node?.open==='debug'){node.debug=debugParts[(debugParts.findIndex(p=>p[0]===node.debug)+1)%debugParts.length][0];paint(node);}}
  else if(k.name==='e'&&!exporting){exporting=true;try{note='Сохранено: '+await onExport();}catch{note='Не удалось сохранить журнал.';}finally{exporting=false;}}
  else return;
  updateHeader();
 };
 const resize=()=>{for(const node of nodes.values())paint(node);for(const group of groups.values())paintGroup(group);updateHeader();};
 journal.on('change',update);renderer.keyInput.on('keypress',key);renderer.on('resize',resize);update();
 const cleanup=()=>{journal.off('change',update);renderer.keyInput.off('keypress',key);renderer.off('resize',resize);};renderer.once('destroy',cleanup);
 return {update,cleanup};
}
export const createTuiRenderer=()=>createCliRenderer({exitOnCtrlC:false,useMouse:true,backgroundColor:'#151c22',consoleOptions:{startInDebugMode:false}});
export async function openTui(journal,options){
 const renderer=await createTuiRenderer();
 try{attachTui(renderer,journal,{...options,onQuit:()=>{options.onQuit?.();renderer.destroy();}});return renderer;}catch(error){renderer.destroy();throw error;}
}
