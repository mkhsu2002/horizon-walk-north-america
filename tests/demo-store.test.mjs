import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoStore,DEMO_STORAGE_KEY,LEGACY_DEMO_KEY,INITIAL_GENERATION,DemoResetConflict} from '../web/demo-store.mjs';
import {applyBatch} from '../web/step-engine.mjs';
function fixture(raw) {
  const data=new Map([['horizon.route66.manual.v1','do not modify']]);
  if(raw) data.set(LEGACY_DEMO_KEY,raw);
  const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  let tail=Promise.resolve(), i=0;
  const locks={request(key,opts,f){
    assert.equal(key,DEMO_STORAGE_KEY); assert.equal(opts.mode,'exclusive');
    const next=tail.then(f); tail=next.catch(()=>{}); return next;
  }};
  return {data, storage, tab:()=>createDemoStore({storage,locks,newGeneration:()=>String(++i)})};
}
const add=(id,steps)=>d=>{const r=applyBatch(d.state,{id,steps});return r.state===d.state?d:{...d,state:r.state};};
test('two tabs compose across one generation without replaying a batch',async()=>{
  const {tab}=fixture(); const a=tab(),b=tab(),g=a.read().generation;
  await Promise.all([a.transact(g,add('a',6000)),b.transact(g,add('b',12000)),b.transact(g,add('a',6000))]);
  assert.equal(a.read().state.totalMm,12_600_000);
  assert.deepEqual([...a.read().state.seenIds],['a','b']);
});
test('queued old add/save/confirm cannot resurrect a reset ledger',async()=>{
  const {tab,data}=fixture(); const a=tab(),b=tab(),g=a.read().generation;
  await a.transact(g,add('old',25290));
  const r=a.reset(g);
  const stale=await Promise.allSettled([b.transact(g,add('stale',12000)),b.transact(g,d=>({...d,postcardSaved:true})),b.reset(g)]);
  await r;
  for(const result of stale) assert.ok(result.reason instanceof DemoResetConflict);
  assert.equal(a.read().state.totalMm,0); assert.equal(a.read().postcardSaved,false);
  assert.equal(data.get('horizon.route66.manual.v1'),'do not modify');
  await b.transact(b.read().generation,add('fresh',6000));
  assert.equal(a.read().state.totalMm,4_200_000);
});
test('published flat v1 remains readable and corrupt bytes fail closed',async()=>{
  const {tab,data,storage}=fixture(JSON.stringify({totalMm:17703000,seenIds:['legacy-id'],awarded:[4200000,12600000,17703000],postcardSaved:true}));
  const a=tab(); assert.equal(a.read().generation,INITIAL_GENERATION); assert.equal(a.read().postcardSaved,true);
  data.set(DEMO_STORAGE_KEY,'{');
  await assert.rejects(a.reset(INITIAL_GENERATION));
  assert.equal(data.get(DEMO_STORAGE_KEY),'{');
  const noLocks=createDemoStore({storage}); await assert.rejects(noLocks.reset(INITIAL_GENERATION));
});

test('migration is once only; even old page writes after reset cannot revive v2',async()=>{
  const raw=JSON.stringify({totalMm:17703000,seenIds:['old'],awarded:[4200000,12600000,17703000],postcardSaved:true});
  const {tab,data}=fixture(raw);
  const a=tab(),b=tab();
  await Promise.all([a.initialize(),b.initialize()]);
  assert.equal(a.read().postcardSaved,true);
  assert.equal(data.get(LEGACY_DEMO_KEY),raw);
  assert.equal(JSON.parse(data.get(DEMO_STORAGE_KEY)).version,2);
  await a.reset(a.read().generation);
  data.delete(LEGACY_DEMO_KEY);
  data.set(LEGACY_DEMO_KEY,raw);
  await b.initialize();
  assert.equal(b.read().state.totalMm,0);
  assert.equal(b.read().postcardSaved,false);
  assert.equal(data.get(LEGACY_DEMO_KEY),raw);
});
test('Demo additional cards write atomically with v2 and cannot revive after reset',async()=>{
  const {tab,data}=fixture(); const a=tab(),b=tab(); const g=(await a.initialize()).generation;
  await a.transact(g,add('reach-all',758692));
  assert.equal(a.read().shelf.earned.length,12);
  await Promise.all([a.save(g,'IL02'),b.save(g,'IL12')]);
  assert.deepEqual(a.read().shelf.saved,['IL02','IL12']);
  assert.deepEqual(JSON.parse(data.get(DEMO_STORAGE_KEY)).shelf.saved,['IL02','IL12']);
  const reset=a.reset(g);
  await assert.rejects(b.save(g,'IL03'),DemoResetConflict);
  await reset;
  assert.deepEqual(a.read().shelf.saved,[]); assert.deepEqual(a.read().shelf.earned,[]);
});
test('malformed v2 shelf fails closed even with valid v1 fallback',async()=>{
  const raw=JSON.stringify({totalMm:17703000,seenIds:['old'],awarded:[4200000,12600000,17703000],postcardSaved:true});
  const {tab,data}=fixture(raw); const a=tab(); await a.initialize();
  const invalid=JSON.stringify({...JSON.parse(data.get(DEMO_STORAGE_KEY)),shelf:{mode:'Manual',earned:[],saved:[]}});
  data.set(DEMO_STORAGE_KEY,invalid);
  await assert.rejects(a.initialize(),/Invalid saved Demo shelf/);
  assert.equal(data.get(DEMO_STORAGE_KEY),invalid);
});
