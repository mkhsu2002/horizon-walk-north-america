/**
 * postcard-shelf.test.mjs
 * Built-in Node test runner tests for postcard-shelf.mjs.
 * Run with: node --test postcard-shelf.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  shelfStorageKey,
  createShelf,
  syncShelf,
  savePostcard,
} from '../web/postcard-shelf.mjs';

import { ILLINOIS_STOPS } from '../web/route-catalog.mjs';

// ---------------------------------------------------------------------------
// Derive test fixtures from the real catalog
// ---------------------------------------------------------------------------

const STOPS = ILLINOIS_STOPS
  .filter(s => s.id !== 'IL00')
  .sort((a, b) => a.meters - b.meters);

// First stop after IL00 (lowest threshold)
const FIRST = STOPS[0];
// Second stop
const SECOND = STOPS[1];
// Last stop
const LAST = STOPS[STOPS.length - 1];

const IL01 = STOPS.find(s => s.id === 'IL01');

// ---------------------------------------------------------------------------
// shelfStorageKey
// ---------------------------------------------------------------------------

describe('shelfStorageKey', () => {
  it('returns demo key for Demo', () => {
    assert.equal(shelfStorageKey('Demo'), 'horizon.route66.postcards.v1.demo');
  });

  it('returns manual key for Manual', () => {
    assert.equal(shelfStorageKey('Manual'), 'horizon.route66.postcards.v1.manual');
  });

  it('throws on unknown mode', () => {
    assert.throws(() => shelfStorageKey('Play'), /Unknown mode/);
  });
});

// ---------------------------------------------------------------------------
// createShelf
// ---------------------------------------------------------------------------

describe('createShelf', () => {
  it('creates empty shelf with correct mode', () => {
    const shelf = createShelf('Demo');
    assert.equal(shelf.mode, 'Demo');
    assert.deepEqual(shelf.earned, []);
    assert.deepEqual(shelf.saved, []);
  });

  it('creates separate empty shelf for Manual', () => {
    const shelf = createShelf('Manual');
    assert.equal(shelf.mode, 'Manual');
  });

  it('throws on bad mode', () => {
    assert.throws(() => createShelf('Foo'), /Unknown mode/);
  });
});

// ---------------------------------------------------------------------------
// syncShelf – threshold boundaries
// ---------------------------------------------------------------------------

describe('syncShelf thresholds', () => {
  it('earns nothing at distance 0', () => {
    const shelf = syncShelf(createShelf('Demo'), 'Demo', 0);
    assert.deepEqual(shelf.earned, []);
  });

  it('earns nothing one mm below first threshold', () => {
    const shelf = syncShelf(createShelf('Demo'), 'Demo', (FIRST.meters * 1000) - 1);
    assert.equal(shelf.earned.includes(FIRST.id), false);
  });

  it('earns first stop at exact threshold', () => {
    const shelf = syncShelf(createShelf('Demo'), 'Demo', (FIRST.meters * 1000));
    assert.ok(shelf.earned.includes(FIRST.id));
  });

  it('earns first stop one mm above threshold', () => {
    const shelf = syncShelf(createShelf('Demo'), 'Demo', (FIRST.meters * 1000) + 1);
    assert.ok(shelf.earned.includes(FIRST.id));
  });

  it('does not earn second stop one mm below its threshold', () => {
    const shelf = syncShelf(createShelf('Demo'), 'Demo', (SECOND.meters * 1000) - 1);
    assert.equal(shelf.earned.includes(SECOND.id), false);
  });

  it('earns second stop at exact threshold', () => {
    const shelf = syncShelf(createShelf('Demo'), 'Demo', (SECOND.meters * 1000));
    assert.ok(shelf.earned.includes(SECOND.id));
  });

  it('earns all stops at or beyond last threshold', () => {
    const shelf = syncShelf(createShelf('Demo'), 'Demo', (LAST.meters * 1000));
    for (const stop of STOPS) {
      assert.ok(shelf.earned.includes(stop.id), `expected ${stop.id} in earned`);
    }
  });

  it('never earns IL00', () => {
    const shelf = syncShelf(createShelf('Demo'), 'Demo', 0);
    assert.equal(shelf.earned.includes('IL00'), false);
  });

  it('never earns unknown id', () => {
    const shelf = syncShelf(createShelf('Demo'), 'Demo', (LAST.meters * 1000) * 10);
    assert.equal(shelf.earned.includes('XX99'), false);
  });

  it('earned array is in canonical stop order', () => {
    const shelf = syncShelf(createShelf('Demo'), 'Demo', (LAST.meters * 1000));
    const ids = shelf.earned;
    for (let i = 1; i < ids.length; i++) {
      const prev = STOPS.findIndex(s => s.id === ids[i - 1]);
      const curr = STOPS.findIndex(s => s.id === ids[i]);
      assert.ok(curr > prev, 'earned should be in canonical order');
    }
  });


});

// ---------------------------------------------------------------------------
// syncShelf – monotonic earned under downward correction
// ---------------------------------------------------------------------------

describe('syncShelf monotonic earned', () => {
  it('previously earned stop survives distance correction downward', () => {
    const s1 = syncShelf(createShelf('Demo'), 'Demo', (FIRST.meters * 1000));
    assert.ok(s1.earned.includes(FIRST.id));

    // Distance goes down (correction)
    const s2 = syncShelf(s1, 'Demo', 0);
    assert.ok(s2.earned.includes(FIRST.id), 'earned must be monotonic');
  });

  it('distance going to 0 after full earn keeps all earned', () => {
    const full = syncShelf(createShelf('Demo'), 'Demo', (LAST.meters * 1000));
    const corrected = syncShelf(full, 'Demo', 0);
    assert.deepEqual(corrected.earned, full.earned);
  });
});

// ---------------------------------------------------------------------------
// syncShelf – saved persistence
// ---------------------------------------------------------------------------

describe('syncShelf saved persistence', () => {
  it('saved cards persist after downward distance correction', () => {
    let shelf = syncShelf(createShelf('Demo'), 'Demo', (FIRST.meters * 1000));
    shelf = savePostcard(shelf, 'Demo', FIRST.id);
    assert.ok(shelf.saved.includes(FIRST.id));

    shelf = syncShelf(shelf, 'Demo', 0);
    assert.ok(shelf.saved.includes(FIRST.id), 'saved must persist after correction');
  });
});

// ---------------------------------------------------------------------------
// syncShelf – legacy IL01 flags
// ---------------------------------------------------------------------------

describe('syncShelf legacy IL01 flags', () => {
  it('legacyIL01Earned adds IL01 to earned even at distance 0', () => {
    if (!IL01) return; // skip if catalog lacks IL01
    const shelf = syncShelf(createShelf('Demo'), 'Demo', 0, { legacyIL01Earned: true });
    assert.ok(shelf.earned.includes('IL01'));
  });

  it('legacyIL01Saved without earned is no-op', () => {
    if (!IL01) return;
    // Distance below IL01 threshold, no legacyIL01Earned
    const shelf = syncShelf(createShelf('Demo'), 'Demo', 0, { legacyIL01Saved: true });
    assert.equal(shelf.saved.includes('IL01'), false,
      'saved migration must not grant IL01 without earned eligibility');
    assert.equal(shelf.earned.includes('IL01'), false);
  });

  it('legacyIL01Saved with legacyIL01Earned adds to saved', () => {
    if (!IL01) return;
    const shelf = syncShelf(createShelf('Demo'), 'Demo', 0, {
      legacyIL01Earned: true,
      legacyIL01Saved: true,
    });
    assert.ok(shelf.earned.includes('IL01'));
    assert.ok(shelf.saved.includes('IL01'));
  });

  it('legacyIL01Saved with threshold eligibility adds to saved', () => {
    if (!IL01) return;
    const shelf = syncShelf(createShelf('Demo'), 'Demo', (IL01.meters * 1000), {
      legacyIL01Saved: true,
    });
    assert.ok(shelf.earned.includes('IL01'));
    assert.ok(shelf.saved.includes('IL01'));
  });

  it('legacyIL01Earned survives subsequent downward correction without flag', () => {
    if (!IL01) return;
    const s1 = syncShelf(createShelf('Demo'), 'Demo', 0, { legacyIL01Earned: true });
    // Now sync again at 0 without flag; earned is monotonic so IL01 must stay
    const s2 = syncShelf(s1, 'Demo', 0);
    assert.ok(s2.earned.includes('IL01'), 'prior earned IL01 must survive');
  });
});

// ---------------------------------------------------------------------------
// syncShelf – idempotency
// ---------------------------------------------------------------------------

describe('syncShelf idempotency', () => {
  it('syncing twice with same distance is idempotent', () => {
    const s1 = syncShelf(createShelf('Demo'), 'Demo', (FIRST.meters * 1000));
    const s2 = syncShelf(s1, 'Demo', (FIRST.meters * 1000));
    assert.deepEqual(s1.earned, s2.earned);
    assert.deepEqual(s1.saved, s2.saved);
  });
});

// ---------------------------------------------------------------------------
// savePostcard
// ---------------------------------------------------------------------------

describe('savePostcard', () => {
  it('saves an earned card', () => {
    let shelf = syncShelf(createShelf('Demo'), 'Demo', (FIRST.meters * 1000));
    shelf = savePostcard(shelf, 'Demo', FIRST.id);
    assert.ok(shelf.saved.includes(FIRST.id));
  });

  it('save of a locked (unearned) card is no-op', () => {
    const shelf = createShelf('Demo');
    // Distance 0 → nothing earned
    const synced = syncShelf(shelf, 'Demo', 0);
    const after = savePostcard(synced, 'Demo', FIRST.id);
    assert.equal(after.saved.includes(FIRST.id), false);
  });

  it('save of IL00 is no-op', () => {
    // Even if somehow IL00 crept into earned (it can't via syncShelf, so test directly)
    const fakeShelf = { mode: 'Demo', earned: ['IL00'], saved: [] };
    const after = savePostcard(fakeShelf, 'Demo', 'IL00');
    assert.deepEqual(after.saved, []);
  });

  it('save of unknown id is no-op', () => {
    const shelf = syncShelf(createShelf('Demo'), 'Demo', (LAST.meters * 1000));
    const after = savePostcard(shelf, 'Demo', 'XX99');
    assert.equal(after.saved.includes('XX99'), false);
  });

  it('repeated save is idempotent', () => {
    let shelf = syncShelf(createShelf('Demo'), 'Demo', (FIRST.meters * 1000));
    shelf = savePostcard(shelf, 'Demo', FIRST.id);
    const again = savePostcard(shelf, 'Demo', FIRST.id);
    assert.deepEqual(shelf.saved, again.saved);
    assert.equal(again.saved.filter(id => id === FIRST.id).length, 1);
  });

  it('saved array stays in canonical order', () => {
    if (STOPS.length < 2) return;
    let shelf = syncShelf(createShelf('Demo'), 'Demo', (LAST.meters * 1000));
    // Save in reverse order
    for (let i = STOPS.length - 1; i >= 0; i--) {
      shelf = savePostcard(shelf, 'Demo', STOPS[i].id);
    }
    for (let i = 1; i < shelf.saved.length; i++) {
      const prev = STOPS.findIndex(s => s.id === shelf.saved[i - 1]);
      const curr = STOPS.findIndex(s => s.id === shelf.saved[i]);
      assert.ok(curr > prev, 'saved should be in canonical order');
    }
  });
});

// ---------------------------------------------------------------------------
// Mode isolation
// ---------------------------------------------------------------------------

describe('mode isolation', () => {
  it('syncShelf rejects cross-mode input', () => {
    const demoShelf = createShelf('Demo');
    assert.throws(() => syncShelf(demoShelf, 'Manual', (FIRST.meters * 1000)), /[Mm]ode/);
  });

  it('savePostcard rejects cross-mode input', () => {
    const demoShelf = syncShelf(createShelf('Demo'), 'Demo', (FIRST.meters * 1000));
    assert.throws(() => savePostcard(demoShelf, 'Manual', FIRST.id), /[Mm]ode/);
  });

  it('Demo and Manual shelves are independent', () => {
    const demo = syncShelf(createShelf('Demo'), 'Demo', (FIRST.meters * 1000));
    const manual = syncShelf(createShelf('Manual'), 'Manual', 0);
    assert.ok(demo.earned.includes(FIRST.id));
    assert.equal(manual.earned.includes(FIRST.id), false);
  });
});

// ---------------------------------------------------------------------------
// No Chicago (IL00) anywhere
// ---------------------------------------------------------------------------

describe('no Chicago (IL00)', () => {
  it('IL00 never appears in earned after full sync', () => {
    const shelf = syncShelf(createShelf('Demo'), 'Demo', (LAST.meters * 1000) * 100);
    assert.equal(shelf.earned.includes('IL00'), false);
  });

  it('IL00 never appears in saved after full save', () => {
    let shelf = syncShelf(createShelf('Demo'), 'Demo', (LAST.meters * 1000));
    for (const stop of STOPS) {
      shelf = savePostcard(shelf, 'Demo', stop.id);
    }
    assert.equal(shelf.saved.includes('IL00'), false);
  });
});

// ---------------------------------------------------------------------------
// Invalid / edge distances
// ---------------------------------------------------------------------------

describe('invalid distances', () => {
  for (const v of [-1, 0.5, NaN, Infinity, '0', undefined, null, Number.MAX_SAFE_INTEGER + 1]) {
    it(`rejects ${String(v)}`, () => assert.throws(() => syncShelf(createShelf('Demo'), 'Demo', v), RangeError));
  }
});

describe('all station boundaries and stale hydration', () => {
  for (const mode of ['Demo', 'Manual']) {
    for (const {id, meters} of STOPS) {
      if (id === 'IL00') continue;
      it(`${mode} ${id}: locked one mm before and earned exactly at threshold`, () => {
        const below = syncShelf(createShelf(mode), mode, meters * 1000 - 1);
        assert.ok(!below.earned.includes(id));
        assert.equal(savePostcard(below, mode, id), below);
        const exact = syncShelf(below, mode, meters * 1000);
        assert.ok(exact.earned.includes(id));
        const saved = savePostcard(exact, mode, id);
        assert.equal(savePostcard(saved, mode, id), saved);
        assert.equal(syncShelf(saved, mode, 0), saved);
      });
    }
  }
  it('ignores stale saved-only state without mutating the old input', () => {
    const original = {mode:'Manual',earned:[],saved:['IL01','IL00','IL12']};
    const result = syncShelf(original, 'Manual', 0);
    assert.deepEqual(result, createShelf('Manual'));
    assert.deepEqual(original.saved,['IL01','IL00','IL12']);
  });
  it('restores a legitimate JSON round-trip without re-award', () => {
    const s = savePostcard(syncShelf(createShelf('Manual'),'Manual',17703000),'Manual','IL01');
    const r = JSON.parse(JSON.stringify(s));
    assert.equal(syncShelf(r,'Manual',17703000),r);
  });
});
