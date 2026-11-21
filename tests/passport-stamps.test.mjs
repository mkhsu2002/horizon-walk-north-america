import {test} from 'node:test';
import assert from 'node:assert/strict';
import {passportStamps} from '../web/passport.mjs';
test('only saved stamps print, with original IL01 governed by its legacy saved flag',()=>{
 assert.deepEqual(passportStamps(['IL12','IL02','IL02','IL00','fake','IL01'],false).map(s=>s.id),['IL02','IL12']);
 assert.deepEqual(passportStamps(['IL02'],true).map(s=>s.id),['IL01','IL02']);
});
test('completed chapter prints 12 ordered stamps with no departure award',()=>{
 const known=Array.from({length:12},(_,i)=>'IL'+String(i+1).padStart(2,'0'));
 assert.deepEqual(passportStamps([...known].reverse(),true).map(s=>s.id),known);
});
