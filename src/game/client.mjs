// No game rules or human-session credentials belong in this client.
import {publicMetadata} from './metadata.mjs';
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status=status; }
}
export function parseInvitation(text) {
  const url=new URL(text.trim());
  if(url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('Приглашение должно использовать HTTPS или локальный сервер.');
  if(url.username || url.password || url.pathname!=='/bot-connect' || url.search)throw new Error('Некорректное приглашение.');
  const match=url.hash.slice(1).match(/^([A-HJ-NP-Z2-9]{6})\.([a-f0-9-]{72})$/);
  if(!match)throw new Error('Вставьте полную ссылку-приглашение, включая часть после #.');
  return {baseUrl:url.origin,code:match[1],invite:match[2]};
}
async function request(baseUrl, code, token, suffix='', data, transport=fetch, method=data===undefined?'GET':'POST') {
  const response=await transport(`${baseUrl}/api/rooms/${code}/bot${suffix}`,{
    method,redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{...(token?{Authorization:`Bearer ${token}`} : {}),'Content-Type':'application/json'},
    ...(data===undefined?{}:{body:JSON.stringify(data)}),
  });
  // Error messages are deliberately fixed: never echo a request or credential.
  if(!response.ok)throw new ApiError(response.status,response.status===401?'Доступ завершён, истёк или отозван.':`Сервер ответил ${response.status}.`);
  return response.json();
}
export async function exchange(text, transport=fetch, metadata=publicMetadata()) {
  const {baseUrl,code,invite}=parseInvitation(text);
  const data=await request(baseUrl,code,null,'/exchange',{invite,harness:metadata.harness,model:metadata.model},transport);
  return {baseUrl,code,token:data.token,playerId:data.playerId};
}
export function client(session, transport=fetch) {
  const send=(suffix,data,method)=>request(session.baseUrl,session.code,session.token,suffix,data,transport,method);
  return {
    state:()=>send(''),
    updateMetadata:(state,{harness,model})=>send('',{version:state.version,gameNumber:state.gameNumber,harness,model},'PATCH'),
    act:(state,actionIndex)=>send('',{version:state.version,gameNumber:state.gameNumber,actionIndex}),
    say:(state,text,messageId=crypto.randomUUID())=>send('',{version:state.version,gameNumber:state.gameNumber,tradeId:state.game?.autoImport?.id,message:text,messageId}),
  };
}
