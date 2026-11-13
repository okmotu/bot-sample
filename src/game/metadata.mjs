// Only these public labels may leave the process; never forward the environment.
export function publicMetadata(env=process.env,model=env.LLM_MODEL) {
 if(['false','0','off'].includes(env.BOT_METADATA?.trim().toLowerCase()))return {harness:null,model:null};
 return {
  harness:(env.BOT_HARNESS ?? 'bot-sample').trim() || null,
  model:(env.BOT_MODEL ?? model ?? '').trim() || null,
 };
}

export async function syncMetadata(api,state,metadata) {
 // Older servers ignore exchange labels and do not advertise botMetadata.
 if(!Object.hasOwn(state,'botMetadata') || state.game?.phase==='finished')return state;
 if(['harness','model'].every(key=>(state.botMetadata?.[key] || null)===metadata[key]))return state;
 await api.updateMetadata(state,metadata);
 // PATCH changes the room version; never use the previous action list afterward.
 return api.state();
}
