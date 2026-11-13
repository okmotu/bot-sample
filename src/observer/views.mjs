import {safeText} from './journal.mjs';
export const phaseName=value=>({setup:'Стартовые карты',roll:'Кубики',reroll:'Переброс',harbor:'Пристань',resolve:'Эффекты',buy:'Строительство',autoimport:'Торги',invest:'Инвестиция',trade:'Обмен',move:'Передача',demolish:'Снос',tv:'Выбор соперника',toykana:'Тойкана',renovate:'Закрытие',exhibit:'Экспоцентр',lobby:'Лобби',finished:'Итог'})[value]||value;
export const resultNames={choosing:'Выбор действия',sending:'Отправка',accepted:'Ход принят',rejected:'Ход отклонён',unknown:'Результат неизвестен',cancelled:'Отменено', 'model-error':'Ошибка модели'};
const n=v=>v==null?'н/д':String(v);
export function names(input){return Object.fromEntries([...(input?.catalog||[]),...(input?.landmarks||[])].map(c=>[c.id,c.name||c.id]));}
export function actionLabel(action,input){
 if(!action)return 'Пока нет';const lookup=names(input),name=value=>typeof value==='object'?(value?.name||value?.id):lookup[value]||value;
 const labels={buy:'Купить',landmark:'Построить',roll:'Бросить',reroll:'Переброс',pass:'Пропустить покупку',chooseStartingCards:'Стартовые карты',resolve:'Активировать',demolish:'Снести',move:'Передать',trade:'Обмен',autoimportChoose:'Автоимпорт',invest:'Инвестиция',harbor:'Пристань',tv:'Выбрать соперника',exhibit:'Экспоцентр',renovate:'Закрыть',toykana:'Тойкана'};
 const details=action.card?name(action.card):action.landmark?name(action.landmark):action.cards? action.cards.map(name).join(' + '):action.count?`${action.count} куб.`:action.choice?({hold:'Держать цену',discount:'Скидка'}[action.choice]||action.choice):'';
 return safeText(`${labels[action.type]||action.type}${details?' · '+details:''}${action.reroll===false?' · оставить':action.reroll===true?' · ещё раз':''}${action.skip?' · пропустить':''}`);
}
// Views return plain semantic spans; only the renderer depends on OpenTUI/FFI.
export const cardColors={blue:'#78bfff',green:'#8cd582',red:'#ff9586',purple:'#d3a0ff',landmark:'#e6c671'};
const refId=v=>typeof v==='object'?v?.id:v;
const chunk=(text,color)=>({text:String(text),...(color?{color}:{})});
const plain=text=>[chunk(text)];
const line=(...parts)=>[...parts.flat().map(v=>typeof v==='object'?v:chunk(v)),chunk('\n')];
const entries=value=>Array.isArray(value)?value:Object.entries(value||{}).map(([id,copies])=>({id,copies}));
const catalog=input=>[...(input.catalog||[]),...(input.landmarks||[]).map(l=>({...l,color:'landmark'}))];
function card(input,value){
 const id=refId(value),c=catalog(input).find(c=>c.id===id);
 return chunk((typeof value==='object'?value?.name:null)||c?.name||id||'н/д',cardColors[c?.color]);
}
function cards(input,values){return values.flatMap((v,i)=>[...(i?plain(' · '):[]),card(input,v)]);}
function legend(){return line(...['blue','green','red','purple'].flatMap((c,i)=>[...(i?plain(' · '):[]),chunk({blue:'Синие',green:'Зелёные',red:'Красные',purple:'Фиолетовые'}[c],cardColors[c])]));}
function context(record){return line(`Снимок до решения #${record.id} · раунд ${record.round} · версия ${record.version}`);}
export function summary(record){return viewContent(record,'turn').map(c=>c.text).join('');}
export function viewContent(record,tab,{debug='actions',width=80}={}){
 if(!record)return plain('Решений пока нет. После начала партии здесь появится первый шаг.');
 const {input,selection,usage,result}=record,g=input.game,me=g.players.find(p=>p.id===input.playerId);
 const out=[];const add=(...parts)=>out.push(...line(...parts));
 if(tab==='table'){
  out.push(...context(record),...legend());
  for(const p of g.players){
   const ls=p.landmarks;
   const built=ls?input.landmarks.filter(l=>ls.some(v=>refId(v)===l.id)).length:null;
   add(`${g.players[g.current]?.id===p.id?'▶':' '} ${p.name||p.id}${p.id===input.playerId?' (бот)':''}  ·  ${n(p.coins)} ◎  ·  Достопр. ${n(built)}/${input.landmarks.length}`);
   const owned=entries(p.cards).filter(c=>c.copies>0);
   const row=owned.flatMap((c,i)=>[...(i?plain(' · '):[]),card(input,c),chunk(` ×${c.copies}${(c.closed??p.closed?.[c.id])?' [закр. '+(c.closed??p.closed[c.id])+']':''}`)]);
   add(row.length?row:p.cards?'Нет предприятий':'Предприятия скрыты');
   add('  ',ls?(ls.length?cards(input,ls):plain('Нет достопримечательностей')):plain('Достопримечательности скрыты'));
   if(p!==g.players.at(-1))add('');
  }
  return out;
 }
 if(tab==='market'){
  const market=entries(g.market).filter(c=>c.copies>0);
  out.push(...context(record),...legend());
  add(`Рынок: ${market.length} видов · У бота ${n(me?.coins)} ◎ · «Можно» = разрешено сервером`);
  add('');
  const nameWidth=Math.max(18,Math.min(30,width-32));
  const pad=(v,n)=>String(v).padEnd(n);
  add(pad('Предприятие',nameWidth),'Бросок'.padEnd(8),'Цена'.padEnd(6),'Шт.'.padEnd(5),'Покупка');
  for(const item of market){
   const c=input.catalog.find(c=>c.id===item.id),label=card(input,item);
   const available=input.actions.some(a=>a.type==='buy'&&refId(a.card)===item.id);
   const status=available?'Можно':c?.cost!=null&&me?.coins!=null&&me.coins<c.cost?`−${c.cost-me.coins} ◎`:'—';
   // Never truncate catalog names: exceptionally long ones get their own line.
   if(label.text.length>nameWidth-1){add(label);add(''.padEnd(nameWidth),pad(c?.activation?.join(', ')||'н/д',8),pad(n(c?.cost),6),pad(item.copies,5),status);}
   else add(label,' '.repeat(nameWidth-label.text.length),pad(c?.activation?.join(', ')||'н/д',8),pad(n(c?.cost),6),pad(item.copies,5),chunk(status,available?'#e6c671':undefined));
  }
  if(!market.length)add(g.market?'Рынок пуст':'Рынок не показан');
  add('');add('— сейчас нет разрешённой покупки; −N ◎ не хватает монет.');
  return out;
 }
 if(tab==='debug'){
  if(debug==='input')return plain(JSON.stringify(input,null,2));
  if(debug==='prompt')return plain(record.systemPrompt||'JavaScript-стратегия: системного промпта нет.');
  for(const a of input.actions){add(`${a.actionIndex===selection?.actionIndex?'▶':' '} [${a.actionIndex}] ${actionLabel(a,input)}`);add(JSON.stringify(a));add('');}
  return out;
 }
 add(`РАУНД ${record.round} · ${phaseName(record.phase)} · версия ${record.version}`);
 add(`Ход: ${g.players[g.current]?.name||'н/д'} · Бот: ${me?.name||'н/д'} · ${n(me?.coins)} ◎`);
 add(`РЕЗУЛЬТАТ: ${resultNames[record.status]||record.status}${result?.httpStatus?' · HTTP '+result.httpStatus:''}`);
 add(record.source==='model'?'Источник: модель':record.source==='strategy'?'Источник: JavaScript-стратегия':'Источник пока не определён');
 add('');
 const action=selection?.action;
 if(action?.type==='buy'||action?.type==='landmark')add('ВЫБОР: ',action.type==='buy'?'Купить · ':'Построить · ',card(input,action.card||action.landmark));
 else add('ВЫБОР: ',actionLabel(action,input));
 if(selection?.alternative)add('АЛЬТЕРНАТИВА: ',actionLabel(selection.alternative,input));
 add(selection?.reason||(record.model?'Модель ещё не вернула объяснение.':'Стратегия без объяснения.'));
 if(record.status==='unknown')add('Ответ потерян: неизвестно, был ли ход применён.');
 if(result?.httpStatus===409)add('Версия изменилась. Бот прочитает новое состояние и выберет заново.');
 add('');add('РАСХОД РЕШЕНИЯ');
 if(record.requested){add(`Вход ${n(usage?.promptTokens)} · кеш ${n(usage?.cachedTokens)} · выход ${n(usage?.completionTokens)}`);add(`Стоимость: ${usage?.cost==null?'н/д':'$'+usage.cost.toFixed(6)}`);}else add('Запроса к модели не было.');
 if(result)add(`Время решения: ${((result.at-record.at)/1000).toFixed(1)} с`);
 if(record.after){add('');add(`СЛЕДУЮЩЕЕ НАБЛЮДЕНИЕ · версия ${record.after.version} · ${phaseName(record.after.phase)}`);add('Между отправкой и чтением могли действовать другие игроки.');}
 return out;
}
export function detailText(record,tab,options){return viewContent(record,tab,options).map(c=>c.text).join('');}
