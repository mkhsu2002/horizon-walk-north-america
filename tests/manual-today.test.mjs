import test from 'node:test';
import assert from 'node:assert/strict';
import { challengeDate, createManualState, setManualDay } from '../web/manual-engine.mjs';
import { DEMO_STORAGE_KEY } from '../web/demo-store.mjs';
import { MANUAL_STORAGE_KEY } from '../web/manual-store.mjs';

const day1 = '2026-11-18', day2 = '2026-11-19';
const zone = 'America/Vancouver';
const before = Date.parse('2026-11-19T06:59:00Z');
const after = Date.parse('2026-11-20T02:30:00Z');
const initial = setManualDay(createManualState(before, zone), day1, 6000, before);
const envelope = state => JSON.stringify({ version: 1, state });

// Exercise the real DOM listeners and store with a minimal isolated event fixture.
async function fixture(t, raw = envelope(initial)) {
  let now = before, focused;
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', hidden: true, handlers: {},
      addEventListener(type, handler) { this.handlers[type] = handler; },
      click() { return this.handlers.click?.(); },
      focus() { focused = id; },
      setAttribute() {}, replaceChildren() {}, classList: { toggle() {} },
    });
    return elements.get(id);
  };
  const row = { prepend(first) { this.firstElementChild = first; } };
  get('hero-demo').parentElement = get('hero-manual').parentElement = row;
  const data = new Map([[MANUAL_STORAGE_KEY, raw], [DEMO_STORAGE_KEY, 'unchanged']]);
  const globals = {
    document: { getElementById: get, querySelector: get },
    window: { localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, val) => data.set(key, val) }, dispatchEvent() {} },
    navigator: { locks: { request: async (_, __, fn) => fn() } },
    addEventListener() {},
  };
  for (const [key, value] of Object.entries(globals)) {
    const prior = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => prior ? Object.defineProperty(globalThis, key, prior) : delete globalThis[key]);
  }
  t.mock.method(Date, 'now', () => now);
  await import('../web/manual.mjs?' + t.name);
  const field = get('manual-steps'), date = get('manual-date');
  return {
    get, date, field, data, focus: () => focused, next: () => { now = after; },
    type: value => { field.value = value; field.handlers.input(); },
    select: value => { date.value = value; date.handlers.change(); },
    save: () => get('manual-form').handlers.submit({ preventDefault() {} }),
    read: () => JSON.parse(data.get(MANUAL_STORAGE_KEY)).state,
  };
}

test('hero logs fixed-zone today across rollover without replacing yesterday', async t => {
  const f = await fixture(t);
  f.get('hero-manual').click();
  assert.equal(f.date.value, day1); // UTC is already Nov 19.
  f.next();
  f.get('hero-manual').click();
  const selected = f.date.value, initialSteps = String(f.field.value);
  assert.equal(f.focus(), 'manual-steps');
  f.type('8000');
  await f.save();
  assert.deepEqual(f.read().days, { [day1]: 6000, [day2]: 8000 });
  assert.equal(selected, day2); // UTC is already Nov 20.
  assert.equal(initialSteps, '');
  f.get('hero-manual').click();
  assert.equal(String(f.field.value), '8000');
  assert.equal(f.data.get(DEMO_STORAGE_KEY), 'unchanged');
});

test('a dirty earlier draft stays visible and can be saved as a deliberate correction', async t => {
  const f = await fixture(t);
  f.get('hero-manual').click();
  f.type('6500');
  f.next();
  f.get('hero-manual').click();
  assert.equal(f.date.value, day1);
  assert.equal(f.field.value, '6500');
  assert.equal(f.get('manual-today-choice').hidden, false);
  assert.equal(f.read().days[day1], 6000);
  f.get('manual-keep-draft').click();
  await f.save();
  assert.match(f.get('manual-status').textContent, /2026-11-18/);
  f.get('hero-manual').click();
  f.type('8000');
  await f.save();
  f.get('mode-manual').click();
  f.select(day1);
  assert.equal(String(f.field.value), '6500');
  f.type('6600');
  await f.save();
  assert.deepEqual(f.read().days, { [day1]: 6600, [day2]: 8000 });
});

test('explicit discard does not overwrite either previously saved day', async t => {
  const f = await fixture(t, envelope(setManualDay(initial, day2, 8000, after)));
  f.type('7000');
  f.next();
  f.get('hero-manual').click();
  assert.equal(f.date.value, day1);
  f.get('manual-discard-draft').click();
  assert.equal(f.date.value, day2);
  assert.equal(String(f.field.value), '8000');
  assert.deepEqual(f.read().days, { [day1]: 6000, [day2]: 8000 });
});

test('invalid stored ledger is not replaced or used to seed today', async t => {
  const f = await fixture(t);
  const invalid = envelope({ ...initial, zone: 'Invalid/Zone' });
  f.data.set(MANUAL_STORAGE_KEY, invalid);
  f.next();
  f.get('hero-manual').click();
  assert.equal(f.date.value, day1);
  assert.match(f.get('manual-status').textContent, /could not be read/);
  f.type('8000');
  await f.save();
  assert.equal(f.data.get(MANUAL_STORAGE_KEY), invalid);
});


test('hero preserves a same-day unsaved edit without showing the earlier-draft choice', async t => {
  const f = await fixture(t);
  f.type('6234');
  f.get('hero-manual').click();
  assert.equal(f.date.value, day1);
  assert.equal(f.field.value, '6234');
  assert.equal(f.get('manual-today-choice').hidden, true);
  assert.equal(f.read().days[day1], 6000);
});

test('Vancouver midnight is consistent under stale and updated zone data, without changing Seattle', async t => {
  const original = Intl.DateTimeFormat;
  const fixtureZones = new Set(['America/Vancouver', 'Canada/Pacific']);
  const instants = ['2026-11-22T06:59:59Z', '2026-11-22T07:00:00Z', '2026-11-22T07:30:00Z'].map(Date.parse);
  const oldDate = '2026-11-21', newDate = '2026-11-22';

  for (const zoneModel of ['America/Los_Angeles', 'Etc/GMT+7']) {
    const patched = t.mock.method(Intl, 'DateTimeFormat', function (locales, opts) {
      return new original(locales, {
        ...opts, timeZone: fixtureZones.has(opts?.timeZone) ? zoneModel : opts?.timeZone,
      });
    });
    try {
      for (const fixedZone of fixtureZones) {
        assert.deepEqual(instants.map(n => challengeDate(n, fixedZone)), [oldDate, newDate, newDate]);
        assert.equal(createManualState(instants[1], fixedZone).activatedOn, newDate);
        const prior = setManualDay(createManualState(instants[0], fixedZone), oldDate, 6000, instants[0]);
        assert.throws(() => setManualDay(prior, newDate, 8000, instants[0]), /future/);
        const next = setManualDay(prior, challengeDate(instants[2], fixedZone), 8000, instants[2]);
        assert.deepEqual(next.days, { [oldDate]: 6000, [newDate]: 8000 });
        assert.equal(next.zone, fixedZone);
      }
      // Seattle uses the same rule as Los Angeles (IANA has no America/Seattle).
      assert.deepEqual(instants.map(n => challengeDate(n, 'America/Los_Angeles')), [oldDate, oldDate, oldDate]);
      assert.equal(challengeDate(instants[2], 'America/Dawson_Creek'), newDate);
    } finally { patched.mock.restore(); }
  }
  const preTransition = Date.parse('2026-02-01T07:30:00Z');
  assert.equal(challengeDate(preTransition, 'America/Vancouver'), '2026-01-31');
  assert.equal(challengeDate(preTransition, 'Canada/Pacific'), '2026-01-31');
});
