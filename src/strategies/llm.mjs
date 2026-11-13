// Optional BYOK strategy. Only the public game projection goes to the model.
import { SYSTEM_PROMPT } from '../prompts/system.mjs';
import {usageMetrics} from '../observer/journal.mjs';
export function modelInput(state, coach=[]) {
  const {game,playerId,actions,catalog,landmarks}=state;
  return {playerId,actions:actions.map((action,actionIndex)=>({actionIndex,...action})),catalog:catalog.map(({art,...card})=>card),landmarks,
    game:{phase:game.phase,current:game.current,players:game.players,market:game.market,
      dice:game.dice,total:game.total,mode:game.mode,greenBoost:game.greenBoost,subsidies:game.subsidies,
      marketState:game.marketState,extraTurn:game.extraTurn,
      autoImport:game.autoImport,startingChoices:game.startingChoices,pendingEffects:game.pendingEffects,
      recentLog:game.log.slice(-12)},...(coach.length?{coach:structuredClone(coach)}:{})};
}
export async function chooseWithModel(state, options={}) {
  const key=options.key ?? process.env.LLM_API_KEY;
  const model=options.model ?? process.env.LLM_MODEL;
  const base=new URL(options.baseUrl ?? process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1/');
  if(!key || !model)throw new Error('Set LLM_API_KEY and LLM_MODEL.');
  if(base.protocol!=='https:' && !(base.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(base.hostname)))throw new Error('LLM endpoint must use HTTPS or localhost.');
  if(!base.pathname.endsWith('/'))base.pathname+='/';
  const response=await (options.transport ?? fetch)(new URL('chat/completions',base),{
    method:'POST',redirect:'error',signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000),
    headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({model,response_format:{type:'json_schema',json_schema:{name:'game_decision',strict:true,schema:{type:'object',properties:{actionIndex:{type:'integer'},alternativeIndex:{type:['integer','null']},reason:{type:'string'}},required:['actionIndex','alternativeIndex','reason'],additionalProperties:false}}},...(base.hostname==='openrouter.ai'?{max_tokens:500}:{max_completion_tokens:500}),
      ...(base.hostname==='openrouter.ai' ? {reasoning:{enabled:false},provider:{data_collection:'deny',require_parameters:true}} : {}),
      messages:[{role:'system',content:SYSTEM_PROMPT},
        {role:'user',content:JSON.stringify(modelInput(state,options.coach))}]})});
  if(!response.ok)throw new Error(`LLM request failed (HTTP ${response.status}).`);
  const data=await response.json();
  options.onUsage?.(usageMetrics({promptTokens:data.usage?.prompt_tokens,completionTokens:data.usage?.completion_tokens,cachedTokens:data.usage?.prompt_tokens_details?.cached_tokens,cost:data.usage?.cost}));
  const decision=JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
  const choice=decision.actionIndex;
  if(!Number.isInteger(choice) || !state.actions[choice])throw new Error('LLM returned invalid action index.');
  const alternativeIndex=Number.isInteger(decision.alternativeIndex)&&decision.alternativeIndex!==choice&&state.actions[decision.alternativeIndex]?decision.alternativeIndex:null;
  options.onDecision?.({actionIndex:choice,alternativeIndex,source:'model',reason:typeof decision.reason==='string'?decision.reason.slice(0,600):null});
  return choice;
}
