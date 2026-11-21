import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createManualState, setManualDay, saveManualPostcard } from '../web/manual-engine.mjs';
import { createManualStore, MANUAL_STORAGE_KEY } from '../web/manual-store.mjs';
import { createManualPostcards, MANUAL_SHELF_KEY } from '../web/manual-postcards.mjs';
import { POSTCARD_MEDIA } from '../web/postcard-media.mjs';

const today = '2026-11-21';
const now = Date.parse(today+'T12:00:00Z');
function setup() {
  const data = new Map([['horizon.route66.postcards.v1.demo','untouched']]);
  const storage = {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  let tail = Promise.resolve();
  const locks = {request(key,options,f) {
    assert.equal(key,MANUAL_STORAGE_KEY); assert.equal(options.mode,'exclusive');
    const next=tail.then(f); tail=next.catch(()=>{}); return next;
  }};
  const shelf=createManualPostcards(storage);
  const tab=()=>createManualStore({storage,locks,postcards:createManualPostcards(storage)});
  return {shelf,tab,data};
}
test('same-lock synthetic tabs retain earned/saved across correction; gate missing art',async()=>{
  const {shelf,tab,data}=setup();
  const a=tab(),b=tab();
  await assert.rejects(a.updatePostcards('IL07'),/not available/);
  await a.transact(()=>createManualState(now-5*86400000,'UTC'));
  for(const day of ['16','17','18','19','20']) await a.transact(s=>setManualDay(s,'2026-11-'+day,90000,now));
  assert.ok(shelf.read().earned.includes('IL07'));
  assert.ok(shelf.read().earned.includes('IL06'));
  await assert.rejects(a.updatePostcards('IL00'),/not available/);
  await Promise.all([a.updatePostcards('IL07'), b.transact(s=>setManualDay(s,'2026-11-20',0,now))]);
  await a.updatePostcards('IL07');
  assert.ok(b.read().totalMm < 305775000);
  assert.deepEqual(shelf.read().saved,['IL07']);
  assert.equal(data.get('horizon.route66.postcards.v1.demo'),'untouched');
  assert.equal(JSON.parse(data.get(MANUAL_STORAGE_KEY)).version,1);
});
test('superseded mileage still imports saved IL01 from existing v1 ledger',async()=>{
  const {data,shelf,tab}=setup();
  const legacy = setManualDay(saveManualPostcard(setManualDay(createManualState(now,'UTC'),today,25290,now)),today,0,now);
  data.set(MANUAL_STORAGE_KEY,JSON.stringify({version:1,state:legacy}));
  const raw = data.get(MANUAL_STORAGE_KEY);
  await tab().updatePostcards();
  assert.deepEqual(shelf.read().saved,['IL01']);
  assert.equal(data.get(MANUAL_STORAGE_KEY),raw);
});
test('corrupt shelf is not replaced and does not interrupt normal ledger writes',async()=>{
  const {data,tab}=setup();
  const a=tab();
  data.set(MANUAL_SHELF_KEY,'{');
  await a.transact(()=>createManualState(now,'UTC'));
  assert.equal(a.read().totalMm,0);
  await assert.rejects(a.updatePostcards());
  assert.equal(data.get(MANUAL_SHELF_KEY),'{');
});
test('approved media is the exact eleven supplied local files',()=>{
  assert.deepEqual(Object.keys(POSTCARD_MEDIA),Array.from({length:11},(_,i)=>'IL'+String(i+2).padStart(2,'0')));
  for(const row of Object.values(POSTCARD_MEDIA)){
    assert.ok(row.credit && row.caption && row.alt && row.rights && (!row.rightsUrl||row.rightsUrl.startsWith('https://')));
    const bytes = readFileSync(new URL('../web/'+row.src,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);
  }
});
