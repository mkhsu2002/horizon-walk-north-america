import test from 'node:test';
import assert from 'node:assert/strict';
import { manualReturnPreview } from '../web/journey-keepsake.mjs';
import { ILLINOIS_STOPS } from '../web/route-catalog.mjs';
import { createManualStore } from '../web/manual-store.mjs';
import { createManualState, setManualDay } from '../web/manual-engine.mjs';

test('undefined, zero, and invalid preview totals do not promote Manual', () => {
  for (const n of [undefined, null, 0, -700, 700.5, '4200000', NaN, Infinity])
    assert.equal(manualReturnPreview(n), null);
});

test('positive Manual preview uses existing stop story and exact remaining steps', () => {
  assert.deepEqual(manualReturnPreview(4_200_000), {
    name: ILLINOIS_STOPS[1].name, teaser: ILLINOIS_STOPS[1].teaser, steps: 19_290,
  });
  assert.equal(manualReturnPreview(17_702_300).steps, 1);
  assert.equal(manualReturnPreview(17_703_000).name, 'Joliet');
});

test('completed route does not invent a further stop, story or steps', () => {
  const finish = ILLINOIS_STOPS.at(-1).meters * 1000;
  assert.deepEqual(manualReturnPreview(finish), { completed: true });
  assert.deepEqual(manualReturnPreview(finish + 700), { completed: true });
});

test('preview accepts only valid read result; disallows inconsistent total and does not write', () => {
  const start = Date.parse('2026-11-18T20:00:00Z');
  const next = Date.parse('2026-11-20T02:30:00Z');
  const init = createManualState(start, 'America/Vancouver');
  const state = setManualDay(init, '2026-11-18', 6000, start);
  const nextState = setManualDay(state, '2026-11-19', 0, next);
  let value = JSON.stringify({ version: 1, state: nextState });
  const store = createManualStore({ storage: {
    getItem: () => value,
    setItem: () => assert.fail('preview must not write a ledger'),
  } });
  assert.equal(manualReturnPreview(store.read().totalMm).steps, 19_290);
  value = JSON.stringify({ version: 1, state: { ...nextState, totalMm: 700 } });
  assert.throws(() => store.read(), /Invalid saved Manual totals/);
  value = null;
  assert.equal(store.read(), null);
});
