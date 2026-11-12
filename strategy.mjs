// Replace this function to build your own bot. Return an index from state.actions.
// This is a working baseline, not a claim of optimal play.
export function chooseAction(state, random=Math.random) {
  const {game,actions,playerId,catalog}=state;
  const me=game.players.find(p=>p.id===playerId);
  const index=predicate=>actions.findIndex(predicate);
  let selected=index(a=>a.type==='landmark');
  if(selected>=0)return selected;
  selected=index(a=>a.type==='roll' && a.count===(me.landmarks.includes('station')?2:1));
  if(selected>=0)return selected;
  selected=index(a=>a.type==='reroll' && !a.reroll || a.type==='harbor' && !a.add || a.type==='invest' && !a.invest);
  if(selected>=0)return selected;
  if(game.phase==='buy') {
    // Develop income first, then save for landmarks instead of buying forever.
    const count=Object.values(me.cards).reduce((sum,n)=>sum+n,0);
    if(count>=7)return index(a=>a.type==='pass');
    const buys=actions.map((a,i)=>({a,i,card:catalog.find(c=>c.id===a.card)})).filter(x=>x.a.type==='buy');
    const preferred=buys.filter(x=>x.card.color==='blue' || x.card.color==='green');
    const options=preferred.length?preferred:buys;
    if(options.length)return options[Math.floor(random()*options.length)].i;
  }
  selected=index(a=>(a.type==='trade' || a.type==='exhibit') && a.skip);
  if(selected>=0)return selected;
  return Math.floor(random()*actions.length);
}
