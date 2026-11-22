import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initPassport,passportStamps} from '../web/passport.mjs';
test('only saved stamps print, with original IL01 governed by its legacy saved flag',()=>{
 assert.deepEqual(passportStamps(['IL12','IL02','IL02','IL00','fake','IL01'],false).map(s=>s.id),['IL02','IL12']);
 assert.deepEqual(passportStamps(['IL02'],true).map(s=>s.id),['IL01','IL02']);
});
test('completed chapter prints 12 ordered stamps with no departure award',()=>{
 const known=Array.from({length:12},(_,i)=>'IL'+String(i+1).padStart(2,'0'));
 assert.deepEqual(passportStamps([...known].reverse(),true).map(s=>s.id),known);
});

test('earned zero-card Manual passport shows only the labeled opening cover, not a stamp at any lane boundary', t => {
  const nodes = new Map();
  const select = key => {
    if (!nodes.has(key)) nodes.set(key, {
      handlers: {}, dataset: {},
      append() {},
      addEventListener(event, handler) { this.handlers[event] = handler; },
      querySelectorAll() { return []; },
      focus() {},
    });
    return nodes.get(key);
  };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true, value: { createElement: () => ({ dataset: {}, append() {} }) },
  });
  t.after(() => descriptor ? Object.defineProperty(globalThis, 'document', descriptor) : delete globalThis.document);
  const render = initPassport({ querySelector: select });
  render('Manual', { firstBadge: false, totalMm: 0, saved: [] });
  assert.equal(select('[data-passport-empty]').hidden, true);
  render('Manual', {
    firstBadge: true, totalMm: 4_200_000, saved: [],
    journeyNote: 'Current log: 1 day with steps entered.',
  });
  select('[data-passport-open]').handlers.click();
  assert.equal(select('[data-passport-sheet]').hidden, false);
  assert.match(select('[data-passport-mode]').textContent, /MANUAL WALK/);
  assert.equal(select('[data-passport-distance]').textContent, 'Distance walked: 4.200 km');
  assert.match(select('[data-passport-note]').textContent, /1 day/);
  assert.match(select('[data-passport-awards]').textContent, /^Earned: First Steps/);
  assert.equal(select('[data-passport-empty]').hidden, false);
  assert.equal(select('[data-passport-card]').hidden, true);
  assert.equal(select('[data-passport-stamps]').dataset.count, '0');
  assert.equal(select('[data-passport-print]').hidden, false);
  for (const count of [1, 2, 12]) {
    const saved = Array.from({ length: count }, (_, i) => 'IL' + String(i + 1).padStart(2, '0'));
    render('Manual', { firstBadge: true, totalMm: 531_084_000, il01: true, postcardSaved: true, saved });
    assert.equal(select('[data-passport-empty]').hidden, true);
    assert.equal(select('[data-passport-stamps]').dataset.count, String(count));
  }
  render('Demo', { firstBadge: true, totalMm: 4_200_000, saved: [] });
  assert.equal(select('[data-passport-empty]').hidden, true);
  assert.equal(select('[data-passport-sheet]').hidden, true);
});


test('opening copy and existing cover art are scoped to the hidden opening piece, outside the stamp grid', () => {
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  const cover = html.match(/<section class="passport-opening"[^>]* hidden>[\s\S]*?<\/section>/)?.[0];
  assert.match(cover, /<h3>Opening page<\/h3>/);
  assert.match(cover, /An ordinary walk is enough to begin a long road\./);
  assert.match(cover, /src="route66-hero\.webp"/);
  assert.match(cover, /Illinois Route 66 cover illustration · Not a collected postcard/);
  assert.match(cover, /No postcards saved yet\./);
  assert.doesNotMatch(cover, /data-passport-stamps|data-stamp-id/);
});
