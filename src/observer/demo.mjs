import {Journal} from './journal.mjs';
import {modelInput} from '../strategies/llm.mjs';
import {SYSTEM_PROMPT} from '../prompts/system.mjs';
// Fixed illustration of a six-player position, not a recorded or live match.
const catalog=[
 {
  "id": "wheat",
  "name": "Арпа",
  "color": "blue",
  "icon": "W",
  "activation": [
   1
  ],
  "cost": 1,
  "description": "+1 монета из банка в любой ход.",
  "set": "base"
 },
 {
  "id": "ranch",
  "name": "Мал",
  "color": "blue",
  "icon": "C",
  "activation": [
   2
  ],
  "cost": 1,
  "description": "+1 монета из банка в любой ход.",
  "set": "base"
 },
 {
  "id": "bakery",
  "name": "Тандыр",
  "color": "green",
  "icon": "B",
  "activation": [
   2,
   3
  ],
  "cost": 1,
  "description": "+1 монета из банка в свой ход.",
  "set": "base"
 },
 {
  "id": "cafe",
  "name": "Кофейня",
  "color": "red",
  "icon": "R",
  "activation": [
   3
  ],
  "cost": 2,
  "description": "1 монета от бросившего соперника.",
  "set": "base"
 },
 {
  "id": "forest",
  "name": "Ала-Арча",
  "color": "blue",
  "icon": "G",
  "activation": [
   5
  ],
  "cost": 3,
  "description": "+1 монета из банка в любой ход.",
  "set": "base"
 },
 {
  "id": "flowers",
  "name": "Теплица",
  "set": "harbor",
  "color": "blue",
  "icon": "W",
  "activation": [
   4
  ],
  "cost": 2,
  "description": "+1 монета из банка в любой ход."
 },
 {
  "id": "flowerShop",
  "name": "Гүлдөр дүкөнү",
  "set": "harbor",
  "color": "green",
  "icon": "B",
  "activation": [
   6
  ],
  "cost": 1,
  "description": "В свой ход: по 1 монете за каждую вашу теплицу."
 },
 {
  "id": "cheese",
  "name": "Молочный цех",
  "color": "green",
  "icon": "F",
  "activation": [
   7
  ],
  "cost": 5,
  "description": "В свой ход: по 3 монеты за каждую вашу карту «Мал».",
  "set": "base"
 },
 {
  "id": "mine",
  "name": "Карьер",
  "color": "blue",
  "icon": "G",
  "activation": [
   9
  ],
  "cost": 6,
  "description": "+5 монет из банка в любой ход.",
  "set": "base"
 },
 {
  "id": "restaurant",
  "name": "Чайхана",
  "color": "red",
  "icon": "R",
  "activation": [
   9,
   10
  ],
  "cost": 3,
  "description": "2 монеты от бросившего соперника.",
  "set": "base"
 },
 {
  "id": "autoImport",
  "name": "Автоимпорт",
  "set": "sharp",
  "color": "blue",
  "icon": "L",
  "activation": [
   5
  ],
  "cost": 4,
  "description": "Торги в любой ход. Все держат цену: по 3; один скидочник: ему 7, остальным по 1; несколько: им 0, остальным по 1. Из банка за открытую копию. Один владелец: по 2. На выбор 5 минут; без ответа — держать цену."
 },
 {
  "id": "antimonopoly",
  "name": "Антимонополия",
  "set": "sharp",
  "color": "purple",
  "icon": "P",
  "activation": [
   8
  ],
  "cost": 6,
  "description": "В свой ход: каждый соперник платит вам по 1 монете за каждую свою копию обычного предприятия сверх первой."
 }
];
const landmarks=[
 {
  "id": "station",
  "name": "Расширение дорог",
  "cost": 4,
  "set": "base",
  "victory": true,
  "description": "Выбирайте один или два кубика."
 },
 {
  "id": "mall",
  "name": "Элитный ЖК",
  "cost": 10,
  "set": "base",
  "victory": true,
  "description": "Каждая карта с символом B или R приносит на 1 монету больше."
 },
 {
  "id": "park",
  "name": "Стадион",
  "cost": 16,
  "set": "base",
  "victory": true,
  "description": "Дубль даёт ещё один ход."
 },
 {
  "id": "tower",
  "name": "Хан-Сарай",
  "cost": 22,
  "set": "base",
  "victory": true,
  "description": "Один раз за ход можно перебросить все кубики."
 },
 {
  "id": "harbor",
  "name": "Пристань",
  "cost": 2,
  "set": "full",
  "victory": true,
  "description": "При результате 10+ можно добавить 2; открывает доход рыболовных предприятий."
 },
 {
  "id": "airport",
  "name": "Аэропорт",
  "cost": 30,
  "set": "full",
  "victory": true,
  "description": "Если ничего не строите в свой ход: +10 монет."
 }
];
export function demoJournal(){
 const journal=new Journal({model:'openai/gpt-5.4-mini',room:'ДЕМО',demo:true});
 const p=(id,name,coins,cards,landmarks,closed={})=>({id,name,coins,cards,landmarks,closed});
 const players=[
  p('bot','Бот-пример',7,{ranch:3,bakery:1,cheese:1},['station','harbor']),
  p('a','Айжан',12,{flowers:3,flowerShop:2,cafe:1},['station','mall','harbor']),
  p('b','Дастан',3,{wheat:2,forest:2,autoImport:1},['station'],{forest:1}),
  p('c','Тико',19,{restaurant:2,cafe:2,antimonopoly:1},['station','mall','park','harbor']),
  p('d','Аза',5,{mine:2,forest:1,bakery:1},['station','tower']),
  p('e','Dima',9,{ranch:2,cheese:2,autoImport:1},['station','mall','harbor'])
 ];
 const market=Object.fromEntries(catalog.map((c,i)=>[c.id,i%3+3]));
 const state={playerId:'bot',version:21,gameNumber:1,actions:[...catalog.filter(c=>c.cost<=7).map(c=>({type:'buy',card:c.id})),{type:'pass'}],catalog,landmarks,game:{startedAt:1000,turnTiming:{startedAt:8000},phase:'buy',current:0,mode:'full',players,market,dice:[3,4],total:7,marketState:{completedRounds:7,order:catalog.map(c=>c.id)},log:[]}};
 const index=state.actions.findIndex(a=>a.card==='cheese');
 let id=journal.begin(state,modelInput(state),SYSTEM_PROMPT);
 journal.request(id);journal.usage(id,{promptTokens:12420,cachedTokens:8192,completionTokens:213,cost:0.0061});
 journal.choose(id,{actionIndex:index,reason:'Молочный цех вместо четвёртого Мала: использует три готовых ресурса.',alternativeIndex:state.actions.findIndex(a=>a.card==='ranch')});journal.result(id,'accepted');
 const after=structuredClone(state);after.version++;after.game.players[0].coins=2;after.game.players[0].cards.cheese=2;after.game.phase='roll';journal.observe(after);
 // Include a rejected decision so history navigation can be exercised too.
 id=journal.begin({...state,version:23},modelInput(state),SYSTEM_PROMPT);
 journal.request(id);journal.usage(id,{promptTokens:12500,cachedTokens:8192,completionTokens:52,cost:0.0049});
 journal.choose(id,{actionIndex:1,reason:'Мал усилит готовые цеха.',alternativeIndex:index});journal.result(id,'rejected',{httpStatus:409});
 // Synthetic UI history, deliberately independent of the game's random engine.
 // No requests, credentials or real match actions are used by this fixture.
 const next=structuredClone(after);next.version=24;
 const purchases=['ranch','cheese','flowers',null,'autoImport','cafe','forest',null,'mine','restaurant','bakery','flowerShop'];
 for(let turn=0;turn<purchases.length;turn++){
  next.game.turnTiming={startedAt:9000+turn*1000};
  next.game.marketState.completedRounds=8+turn;next.game.phase='roll';next.game.dice=[];next.game.total=null;
  next.game.players[0].coins=4+(turn%5);
  next.actions=[{type:'roll',count:1},{type:'roll',count:2}];
  journal.observe(next);
  const calculated=turn%3===0;
  if(calculated)next.actions=[{type:'roll',count:2}];
  id=journal.begin(next,modelInput(next),SYSTEM_PROMPT);
  if(!calculated){journal.request(id);journal.usage(id,{promptTokens:12700+turn*30,cachedTokens:10240,completionTokens:48,cost:0.0032});}
  journal.choose(id,{actionIndex:calculated?0:1,reason:calculated?'Единственное разрешённое действие (пример автоматического решения).':'Два кубика вместо одного: цель — активация молочных цехов на 7.',source:calculated?'strategy':'model',alternativeIndex:calculated?null:0});
  journal.result(id,'accepted');next.version++;
  next.game.phase='buy';next.game.dice=[3,4];next.game.total=7;next.game.players[0].coins+=6;
  const chosen=purchases[turn];
  next.actions=[...catalog.filter(c=>c.cost<=next.game.players[0].coins&&next.game.market[c.id]>0).map(c=>({type:'buy',card:c.id})),{type:'pass'}];
  journal.observe(next);id=journal.begin(next,modelInput(next),SYSTEM_PROMPT);
  journal.request(id);journal.usage(id,{promptTokens:13200+turn*30,cachedTokens:10240,completionTokens:180+turn,cost:0.0054});
  const actionIndex=next.actions.findIndex(a=>chosen?a.card===chosen:a.type==='pass');
  const name=catalog.find(c=>c.id===chosen)?.name;
  journal.choose(id,{actionIndex,alternativeIndex:chosen?next.actions.length-1:0,reason:chosen?`${name} вместо накопления: пример покупки в демо-истории.`:'Пропуск вместо покупки: сохраняю монеты для достопримечательности.'});
  journal.result(id,'accepted');
  if(chosen){next.game.players[0].cards[chosen]=(next.game.players[0].cards[chosen]||0)+1;next.game.players[0].coins-=catalog.find(c=>c.id===chosen).cost;next.game.market[chosen]--;}
  next.version++;next.game.phase='roll';next.actions=[];journal.observe(next);
 }
 journal.status('demo','Демо: 6 игроков · 26 решений · без сетевых запросов');return journal;
}
