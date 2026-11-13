import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoJournal} from '../src/observer/demo.mjs';
import {detailText,viewContent,cardColors} from '../src/observer/views.mjs';

test('market shows every type, all colors, server permission and missing money',()=>{
 const r=demoJournal().data.records[0];r.input.game.players[0].coins=2;
 r.input.actions=r.input.actions.filter(a=>a.type!=='buy'||a.card==='ranch');
 const text=detailText(r,'market');
 assert.match(text,/Рынок: 12 видов/);
 assert.match(text,/Мал[^\n]+Можно/);assert.match(text,/Арпа[^\n]+—/);assert.match(text,/Карьер[^\n]+−4 ◎/);
 const spans=viewContent(r,'market');for(const color of ['blue','green','red','purple'])assert.ok(spans.some(s=>s.color===cardColors[color]));
});

test('hidden balances remain unknown, long names wrap and historic snapshots stay immutable',()=>{
 const records=demoJournal().data.records,r=records[0],p=r.input.game.players[1];
 delete p.cards;delete p.coins;delete p.landmarks;
 assert.match(detailText(r,'table'),/Айжан  ·  н\/д ◎  ·  Достопр\. н\/д\/6\nПредприятия скрыты\n  Достопримечательности скрыты/);
 const name='Очень длинное название предприятия без обрезания';r.input.catalog[0].name=name;
 assert.ok(detailText(r,'market',{width:60}).includes(name+'\n'));
 assert.equal(r.input.game.players[0].cards.ranch,3);
 assert.ok(records.at(-1).input.game.players[0].cards.ranch>3);
 assert.ok(records.every(r=>r.selection.action));
 assert.ok(records.some(r=>r.source==='strategy'&&!r.requested));
 assert.ok(records.every(r=>!Object.hasOwn(r,'plan')));
 assert.match(detailText(r,'turn'),/АЛЬТЕРНАТИВА: Купить · Мал/);
});
