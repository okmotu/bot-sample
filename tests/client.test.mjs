import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInvitation,exchange,client } from '../src/game/client.mjs';

const invite='http://localhost:5177/bot-connect#ABCDEF.'+('a'.repeat(36)+'b'.repeat(36));
test('invitation only goes in POST body; redirects disabled, no token in URLs',async()=>{
 assert.equal(parseInvitation(invite).code,'ABCDEF');
 assert.throws(()=>parseInvitation(invite.replace('localhost:5177','example.com')));
 assert.throws(()=>parseInvitation(invite.replace('/bot-connect','/elsewhere')));
 const calls=[];const transport=async(url,options)=>{calls.push({url,options});return Response.json({token:'secret',playerId:'p',code:'ABCDEF'});};
 const session=await exchange(invite,transport);
 await client(session,transport).state();
 await client(session,transport).act({version:3,gameNumber:1},2);
 assert.equal(calls[0].options.headers.Authorization,undefined);
 assert.equal(JSON.parse(calls[0].options.body).invite,parseInvitation(invite).invite);
 for(const c of calls){assert.equal(c.options.redirect,'error');assert.ok(!c.url.includes('secret'));assert.ok(!c.url.includes('#'));}
 assert.equal(calls[1].options.headers.Authorization,'Bearer secret');
 assert.deepEqual(JSON.parse(calls[2].options.body),{version:3,gameNumber:1,actionIndex:2});
});
