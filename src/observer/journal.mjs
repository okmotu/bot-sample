import {turnContext} from './turns.mjs';
import {EventEmitter} from 'node:events';
import {writeFile,chmod} from 'node:fs/promises';

const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
export function usageMetrics(usage={}){
 const input=number(usage.promptTokens),cached=number(usage.cachedTokens);
 return {promptTokens:input,completionTokens:number(usage.completionTokens),cachedTokens:cached!==null&&input!==null&&cached>input?null:cached,cost:number(usage.cost)};
}
// Strip terminal controls and known credentials even if a provider echoes them in prose.
export function safeText(value,secrets=[]){
 let text=String(value??'');
 for(const secret of secrets)if(secret)text=text.split(secret).join('[скрыто]');
 return text.replace(/https?:\/\/[^\s"<>]*\/bot-connect#[^\s"<>]+/g,'[приглашение скрыто]').replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g,'');
}
function safeCopy(value,secrets){
 if(typeof value==='string')return safeText(value,secrets);
 if(Array.isArray(value))return value.map(v=>safeCopy(v,secrets));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!/(?:token|secret|password|authorization|apiKey|api_key|invite|invitation)/i.test(key)).map(([k,v])=>[safeText(k,secrets),safeCopy(v,secrets)]));
 return value;
}
export class Journal extends EventEmitter {
 constructor({model=null,room=null,limit=200,secrets=[],demo=false}={}){
  super();this.limit=limit;this.secrets=secrets;this.data={model:model?safeText(model,secrets):null,room:room?safeText(room,secrets):null,demo,status:'connecting',message:'Подключение',records:[],latest:null,totals:{requests:0,cost:0,unknownCost:0,promptTokens:0,completionTokens:0,cachedTokens:0,unknownTokens:0},dropped:0};this.nextId=1;
 }
 status(status,message){this.data.status=status;this.data.message=safeText(message,this.secrets);this.emit('change');}
 observe(state){
  if(this.data.latest?.version===state.version&&this.data.latest?.gameNumber===state.gameNumber)return;
  this.data.latest={version:state.version,gameNumber:state.gameNumber,phase:state.game?.phase??'lobby'};
  const last=this.data.records.at(-1);
  if(last?.status==='accepted'&&!last.after&&state.version>last.version&&state.gameNumber===last.gameNumber){last.after={...this.data.latest,players:safeCopy(state.game?.players?.map(({id,name,coins,cards,landmarks,closed})=>({id,name,coins,cards,landmarks,closed})),this.secrets)};}
  this.emit('change');
 }
 begin(state,input,systemPrompt){
  const record={id:this.nextId++,at:Date.now(),version:state.version,gameNumber:state.gameNumber,round:(state.game?.marketState?.completedRounds??0)+1,phase:state.game?.phase,model:this.data.model,status:'choosing',input:safeCopy(input,this.secrets),systemPrompt:safeText(systemPrompt,this.secrets),selection:null,result:null,usage:null,requested:false};
  record.turn=safeCopy(turnContext(state,record.id),this.secrets);
  this.data.records.push(record);if(this.data.records.length>this.limit){this.data.records.shift();this.data.dropped++;}this.emit('change');return record.id;
 }
 find(id){return this.data.records.find(r=>r.id===id);}
 request(id){const r=this.find(id);if(!r||r.requested)return;r.requested=true;this.data.totals.requests++;this.data.totals.unknownCost++;this.data.totals.unknownTokens++;this.emit('change');}
 usage(id,value){
  const r=this.find(id);if(!r||r.usage)return;this.request(id);r.usage=usageMetrics(value);const t=this.data.totals;
  if(r.usage.cost!==null){t.cost+=r.usage.cost;t.unknownCost--;}
  if(r.usage.promptTokens!==null&&r.usage.completionTokens!==null&&r.usage.cachedTokens!==null)t.unknownTokens--;
  for(const key of ['promptTokens','completionTokens','cachedTokens'])t[key]+=r.usage[key]??0;this.emit('change');
 }
 choose(id,{actionIndex,reason,alternativeIndex=null,source}){
  const r=this.find(id);if(!r)return;
  const alternative=Number.isInteger(alternativeIndex)&&alternativeIndex!==actionIndex?r.input.actions.find(a=>a.actionIndex===alternativeIndex):null;
  r.selection={actionIndex,action:safeCopy(r.input.actions.find(a=>a.actionIndex===actionIndex),this.secrets),reason:reason==null?null:safeText(reason,this.secrets),alternative:alternative?safeCopy(alternative,this.secrets):null};
  r.source=source || (r.requested?'model':'strategy');r.status='sending';this.emit('change');
 }
 result(id,status,{httpStatus=null}={}){const r=this.find(id);if(!r)return;r.status=status;r.result={status,httpStatus,at:Date.now()};this.emit('change');}
 snapshot(){return structuredClone(this.data);}
 async export(path){await writeFile(path,JSON.stringify(this.data,null,2)+'\n',{mode:0o600,flag:'wx'});await chmod(path,0o600);}
}
