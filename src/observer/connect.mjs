import {BoxRenderable,TextRenderable} from '@opentui/core';
import {parseInvitation,exchange,ApiError} from '../game/client.mjs';
import {saveSession} from '../game/session.mjs';

// No invitation or exchanged token enters a renderable or the decision journal.
export function promptConnection(renderer,{exchangeInvitation=exchange,persist=saveSession}={}){
 return new Promise(resolve=>{
  let value='',cursor=0,all=false,focus=0,busy=false,done=false,pending=null,message='Вставьте ссылку из лобби игры. Enter — подключиться.';
  const root=new BoxRenderable(renderer,{id:'connect-screen',width:'100%',height:'100%',backgroundColor:'#151c22',alignItems:'center',justifyContent:'center'});
  const box=new BoxRenderable(renderer,{id:'connect-dialog',width:72,flexDirection:'column',border:true,borderColor:'#8caa78',padding:1});
  const title=new TextRenderable(renderer,{content:'BOT SAMPLE · Подключение бота',fg:'#d3b775',width:'100%',wrapMode:'word'});
  const label=new TextRenderable(renderer,{content:'Ссылка-приглашение',fg:'#e1e4df',width:'100%'});
  const input=new TextRenderable(renderer,{id:'invitation',height:2,width:'100%',selectable:false,onMouseDown:e=>{if(e.button===0){focus=0;paint();}}});
  const status=new TextRenderable(renderer,{id:'connection-status',width:'100%',wrapMode:'word',fg:'#a8b8b2'});
  const controls=new BoxRenderable(renderer,{flexDirection:'row',height:1});
  const submit=new TextRenderable(renderer,{id:'connect-submit',width:20,height:1,selectable:false,onMouseDown:e=>{if(e.button===0){focus=1;void connect();}}});
  const cancel=new TextRenderable(renderer,{id:'connect-cancel',width:12,height:1,selectable:false,onMouseDown:e=>{if(e.button===0)finish(null);}});
  const hint=new TextRenderable(renderer,{content:'Tab — кнопки · Ctrl+U — очистить · Esc — выход',width:'100%',wrapMode:'word',fg:'#93a0a6'});
  controls.add(submit);controls.add(cancel);box.add(title);box.add(label);box.add(input);box.add(status);box.add(controls);box.add(hint);root.add(box);renderer.root.add(root);
  function paint(){
   if(done)return;
   box.width=Math.max(24,Math.min(72,renderer.width-4));
   const visible=Math.max(1,Math.min(58,renderer.width-12));
   input.content=value?`${'•'.repeat(Math.min(value.length,visible))}${value.length>visible?'…':''}\n${all?'Выделено всё · ':''}${value.length} символов · позиция ${cursor}`:'Вставьте полную ссылку (секрет будет скрыт)';
   input.fg=focus===0?'#e1e4df':'#a8b8b2';input.bg=focus===0?'#283a35':'#202e2b';
   status.content=message;
   submit.content=busy?' Подключаем… ':pending?' Сохранить ':' Подключиться ';
   cancel.content=' Отмена ';
   for(const [i,b] of [[1,submit],[2,cancel]]){b.fg=focus===i?'#151c22':'#d3b775';b.bg=focus===i?'#d3b775':'#151c22';}
  }
  function cleanup(){renderer.keyInput.off('keypress',key);renderer.keyInput.off('paste',paste);renderer.off('resize',paint);renderer.off('destroy',destroyed);value='';renderer.root.remove(root);root.destroyRecursively();}
  function finish(session){if(done)return;done=true;cleanup();resolve(session);}
  function destroyed(){finish(null);}
  async function connect(){
   if(busy||done)return;
   if(!pending){try{parseInvitation(value);}catch{message='Нужна полная ссылка /bot-connect#… из лобби.';paint();return;}}
   busy=true;message=pending?'Сохраняем подключение…':'Подключаемся к комнате…';paint();
   try{
    if(!pending)pending=await exchangeInvitation(value);
    // Once exchanged, retry only disk persistence: the invitation is single-use.
    value='';cursor=0;all=false;
    await persist(pending);finish(pending);
   }catch(error){
    if(done)return;
    message=pending?'Не удалось сохранить подключение. Нажмите «Сохранить» для повтора.':error instanceof ApiError&&[400,401,404,410].includes(error.status)?'Приглашение недействительно или истекло. Создайте новое в лобби.':'Нет ответа от сервера. Проверьте подключение и повторите.';
   }finally{busy=false;paint();}
  }
  function insert(text){if(busy||pending)return;const clean=text.replace(/[\x00-\x20\x7f-\x9f]/g,'');if(all){value='';cursor=0;all=false;}const part=clean.slice(0,2048-value.length);value=value.slice(0,cursor)+part+value.slice(cursor);cursor+=part.length;paint();}
  function paste(e){e.preventDefault();e.stopPropagation();focus=0;insert(new TextDecoder().decode(e.bytes));}
  function key(e){
   e.preventDefault();e.stopPropagation();
   if(e.name==='escape'||e.name==='c'&&e.ctrl){finish(null);return;}
   if(e.name==='tab'){focus=(focus+(e.shift?2:1))%3;paint();return;}
   if(e.name==='return'){if(focus===2)finish(null);else void connect();return;}
   if(focus!==0||busy||pending)return;
   if(e.ctrl&&e.name==='a'){all=true;}
   else if(e.ctrl&&e.name==='u'){value='';cursor=0;all=false;}
   else if(e.name==='left'){cursor=Math.max(0,cursor-1);all=false;}
   else if(e.name==='right'){cursor=Math.min(value.length,cursor+1);all=false;}
   else if(e.name==='home'){cursor=0;all=false;}
   else if(e.name==='end'){cursor=value.length;all=false;}
   else if(e.name==='backspace'||e.name==='delete'){
    if(all){value='';cursor=0;all=false;}else if(e.name==='backspace'&&cursor>0){value=value.slice(0,cursor-1)+value.slice(cursor);cursor--;}else if(e.name==='delete')value=value.slice(0,cursor)+value.slice(cursor+1);
   }else if(!e.ctrl&&!e.meta&&e.sequence?.length===1){insert(e.sequence);return;}
   paint();
  }
  renderer.keyInput.on('keypress',key);renderer.keyInput.on('paste',paste);renderer.on('resize',paint);renderer.once('destroy',destroyed);paint();
 });
}
