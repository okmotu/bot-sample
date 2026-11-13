// Use the server's turn clock, not phase or room version: both change within a turn.
export function turnContext(state,recordId){
 const g=state.game||{},setup=g.phase==='setup',actor=setup?g.players?.find(p=>p.id===state.playerId):g.players?.[g.current];
 const start=g.turnTiming?.startedAt,completed=g.stats?.players?.[actor?.id]?.turnsCompleted;
 const known=Number.isFinite(start)||Number.isSafeInteger(completed);
 const scope=[state.gameNumber??null,g.startedAt??null];
 return {key:JSON.stringify([...scope,setup?'setup':known?'turn':'unknown',actor?.id??null,setup?null:Number.isFinite(start)?start:null,setup?null:Number.isSafeInteger(completed)?completed:null,...(!setup&&!known?[recordId]:[])]),
  known:setup||known,setup,actorId:actor?.id??null,actorName:actor?.name??null,own:actor?.id===state.playerId,
  round:Number.isSafeInteger(g.marketState?.completedRounds)?g.marketState.completedRounds+1:null};
}
export function groupTurns(records){
 const result=[],seen=new Set();
 for(const record of records){
  const turn=record.turn||{key:`unknown-${record.id}`,known:false,round:record.round};
  let group=result.at(-1);
  if(!group||group.turn.key!==turn.key){const id=seen.has(turn.key)?`${turn.key}:${record.id}`:turn.key;seen.add(turn.key);group={id,turn,records:[]};result.push(group);}
  group.records.push(record);
 }
 return result;
}
export function turnTitle(group,collapsed=false){
 const {turn,records}=group;
 const title=turn.setup?'Стартовые карты':turn.known?`Раунд ${turn.round??'н/д'} · Ход ${turn.actorName||'н/д'}${turn.own?' (бот)':''}`:`Раунд ${turn.round??'н/д'} · Ход не определён`;
 const cost=records.reduce((n,r)=>n+(r.usage?.cost??0),0),unknown=records.some(r=>r.requested&&r.usage?.cost==null);
 return `${collapsed?'▸':'▾'} ${title} · Решений: ${records.length}${cost?' · $'+cost.toFixed(4):''}${unknown?' · стоимость неполная':''}`;
}
