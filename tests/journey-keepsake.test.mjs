import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addDeparture, DEPARTURE_ID, demoJourneyNote, manualJourneyNote, manualMilestones } from '../web/journey-keepsake.mjs';
import { createDemoStore, DEMO_STORAGE_KEY } from '../web/demo-store.mjs';
import { createManualStore, MANUAL_STORAGE_KEY } from '../web/manual-store.mjs';
import { createManualState, setManualDay } from '../web/manual-engine.mjs';
import { applyBatch, createState } from '../web/step-engine.mjs';

function harness() {
  const data = new Map();
  const storage = { getItem: id => data.get(id) ?? null, setItem: (id, val) => data.set(id, val) };
  let pending = Promise.resolve();
  const locks = { request(key, options, fn) { const next = pending.then(fn); pending = next.catch(() => {}); return next; } };
  return { storage, locks, newGeneration: () => 'next-demo-generation' };
}

test('departure commits one simulated leg under authority lock, survives reload, and never unlocks a stop or award', async () => {
  const opts = harness();
  const a = createDemoStore(opts);
  const b = createDemoStore(opts);
  const before = await a.initialize();
  const generation = before.generation;
  await Promise.all([a.transact(generation, addDeparture), b.transact(generation, addDeparture)]);
  const reload = createDemoStore(opts).read();
  assert.equal(reload.state.totalMm, 350_000);
  assert.deepEqual([...reload.state.seenIds], [DEPARTURE_ID]);
  assert.equal(reload.state.awarded.size, 0);
  assert.equal(reload.postcardSaved, false);
  assert.deepEqual(reload.shelf.saved, []);
  assert.equal(opts.storage.getItem(MANUAL_STORAGE_KEY), null);
});

test('existing Demo user bypasses the departure; never adds 500 steps or erases saved postcards', () => {
  const { state } = applyBatch(createState(), { id: 'prior-guided-leg', steps: 25_290 });
  const existing = { state, postcardSaved: true };
  assert.equal(addDeparture(existing), existing);
});

test('Manual counts actual positive log dates at equal totals; notes remain honest after a corrected zero', async () => {
  const opts = harness();
  const store = createManualStore(opts);
  let initial = createManualState(Date.UTC(2026, 10, 18, 12), 'UTC');
  const now = Date.UTC(2026, 10, 22, 12);
  const day = (start, date, n) => setManualDay(start, date, n, now);
  const oneDay = day(initial, '2026-11-18', 25_290);
  const threeDays = day(day(day(initial, '2026-11-18', 8_430), '2026-11-19', 8_430), '2026-11-20', 8_430);
  assert.equal(oneDay.totalMm, threeDays.totalMm);
  assert.equal(oneDay.awards.il01, true);
  assert.equal(threeDays.awards.il01, true);
  assert.match(manualJourneyNote(oneDay), /1 day with steps entered/);
  await store.transact(() => threeDays);
  assert.match(manualJourneyNote(store.read()), /3 days with steps entered/);
  assert.match(manualJourneyNote(day(threeDays, '2026-11-20', 0)), /2 days/);
  assert.equal(opts.storage.getItem(DEMO_STORAGE_KEY), null);
});

test('equal-length Demo ledgers can produce different leg counts without historical claims', () => {
  const state = createState();
  const oneLeg = applyBatch(state, { id: 'one', steps: 25_290 }).state;
  const twoLegs = applyBatch(addDeparture({ state }).state, { id: 'two', steps: 24_790 }).state;
  assert.equal(oneLeg.totalMm, twoLegs.totalMm);
  assert.match(demoJourneyNote(oneLeg), /1 recorded simulated leg\./);
  assert.match(demoJourneyNote(twoLegs), /2 recorded simulated legs\./);
  assert.equal(demoJourneyNote({ ...state, totalMm: 17_703_000 }), '');
});

test('manual milestone uses exact catalog and first-badge step counts', () => {
  assert.deepEqual(manualMilestones(0), { firstBadgeSteps: 6_000, nextName: 'North Lawndale', nextSteps: 25_290 });
  assert.equal(manualMilestones(4_199_300).firstBadgeSteps, 1);
  assert.equal(manualMilestones(4_200_000).firstBadgeSteps, 0);
  assert.equal(manualMilestones(17_702_300).nextSteps, 1);
  assert.equal(manualMilestones(17_703_000).nextName, 'Joliet');
});

test('hero sample is separate from owned passport, UI and exactly two existing illustrations', () => {
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  const sample = html.match(/<aside class="example-passport"[\s\S]*?<\/aside>/)?.[0];
  assert.ok(sample);
  assert.match(sample, /Sample · Not your progress/);
  assert.equal((sample.match(/<figure>/g) ?? []).length, 2);
  assert.doesNotMatch(sample, /data-passport|<button|<form/);
  const css = readFileSync(new URL('../web/styles.css', import.meta.url), 'utf8');
  assert.match(css, /body > :not\(#passport\)[\s\S]*?display:none!important/);
});
