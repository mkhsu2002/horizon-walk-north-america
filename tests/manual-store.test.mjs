import test from 'node:test';
import assert from 'node:assert/strict';
import { createManualState, setManualDay, saveManualPostcard } from '../web/manual-engine.mjs';
import { MANUAL_STORAGE_KEY as KEY, createManualStore } from '../web/manual-store.mjs';

const NOW = Date.UTC(2026, 10, 21, 15);
const ACTIVATION = Date.UTC(2026, 10, 20, 15);
const first = createManualState(ACTIVATION, 'America/Vancouver');
function setup() {
  const data = new Map([['horizon.route66.demo.v1','demo untouched']]);
  let tail = Promise.resolve();
  const locks = { request(name, {mode}, task) {
    assert.equal(name, KEY); assert.equal(mode, 'exclusive');
    const next = tail.then(task); tail = next.catch(() => {}); return next;
  }};
  const storage = { getItem:k => data.get(k) ?? null, setItem:(k,v) => data.set(k,v) };
  return { data, locks, storage, a:createManualStore({storage,locks}), b:createManualStore({storage,locks}) };
}
const put = (date, n) => state => setManualDay(state, date, n, NOW);

test('read missing, then legacy-compatible activation without replacing an existing challenge', async () => {
  const {a,b,data}=setup();
  assert.equal(a.read(),null);
  await a.transact(s=>s ?? first);
  const value=data.get(KEY);
  await b.transact(s=>s ?? createManualState(NOW, 'UTC'));
  assert.deepEqual(JSON.parse(value),{version:1,state:first});
  assert.equal(data.get(KEY),value);
});
test('two already-open tabs preserve different daily dates', async () => {
  const {a,b,data}=setup();
  await a.transact(()=>first);
  assert.deepEqual(a.read().days,b.read().days);
  await Promise.all([a.transact(put('2026-11-20',6000)),b.transact(put('2026-11-21',12000))]);
  assert.deepEqual(a.read().days,{'2026-11-20':6000,'2026-11-21':12000});
  assert.equal(a.read().totalMm,12600000);
  assert.equal(data.get('horizon.route66.demo.v1'),'demo untouched');
});
test('same date replaces rather than adds and preserves a postcard saved by the other tab', async () => {
  const {a,b}=setup();
  await a.transact(() => setManualDay(first,'2026-11-21',25290,NOW));
  const staleB = b.read();
  assert.equal(staleB.postcardSent,false);
  await Promise.all([a.transact(saveManualPostcard),b.transact(put('2026-11-21',5999))]);
  assert.equal(a.read().totalMm,4199300);
  assert.deepEqual(a.read().days,{'2026-11-21':5999});
  assert.equal(a.read().postcardSent,true);
  assert.equal(a.read().awards.il01,true);
});
test('malformed JSON, wrong envelope, mismatched total and invalid dates fail closed', async () => {
  const {a,data}=setup();
  for (const raw of ['{',JSON.stringify({version:2,state:first}),JSON.stringify({version:1,state:{...first,totalMm:9}}),JSON.stringify({version:1,state:{...first,days:{'2026-02-30':1}}})]) {
    data.set(KEY,raw); let called=false;
    assert.throws(()=>a.read());
    await assert.rejects(a.transact(()=>{called=true;return first;}));
    assert.equal(called,false); assert.equal(data.get(KEY),raw);
  }
});
test('absent Web Locks allows existing read but no unsafe write', async () => {
  const {a,storage,data}=setup(); await a.transact(()=>first);
  const without=createManualStore({storage});
  assert.deepEqual(without.read(),first);
  await assert.rejects(without.transact(put('2026-11-21',1)),/Web Locks/);
  assert.deepEqual(JSON.parse(data.get(KEY)).state,first);
});
test('lock denial or inaccessible write does not disturb another tab', async () => {
  const {a,storage,locks,data}=setup(); await a.transact(()=>first);
  const prior=data.get(KEY);
  await assert.rejects(createManualStore({storage,locks:{request:()=>Promise.reject(new Error('denied'))}}).transact(put('2026-11-21',1)),/denied/);
  const denied=createManualStore({locks,storage:{getItem:storage.getItem,setItem(){throw new Error('unavailable');}}});
  await assert.rejects(denied.transact(put('2026-11-21',1)),/unavailable/);
  assert.equal(data.get(KEY),prior);
  await a.transact(put('2026-11-21',1));
  assert.equal(a.read().totalMm,700);
});
test('identity operation skips storage writes and all queued failures release the lock', async () => {
  const {a,b,data}=setup();
  const result=await a.transact(s=>s);
  assert.equal(result,null); assert.equal(data.has(KEY),false);
  await assert.rejects(a.transact(async()=>first),/Invalid/);
  await b.transact(()=>first);
  assert.deepEqual(b.read(),first);
});
