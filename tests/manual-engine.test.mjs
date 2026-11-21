/**
 * manual-engine.test.mjs
 *
 * Built-in Node test runner (node:test + node:assert).
 * Run with:  node --test manual-engine.test.mjs
 *
 * No third-party dependencies.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createManualState,
  challengeDate,
  setManualDay,
  saveManualPostcard,
} from '../web/manual-engine.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a UTC ms timestamp from a YYYY-MM-DD string (midnight UTC). */
function utcMs(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Fake a specific wall-clock time in a named IANA zone.
 * We want the Intl clock to report `localDate` as today in `zone`.
 * The simplest approach: use UTC midnight of that date, which is "today"
 * in UTC+0 and zones east of UTC (they're already past midnight by then),
 * but for zones well west of UTC we may land in the previous day.
 *
 * To guarantee `localDate` is "today" in zone, we sample noon UTC of that
 * date — noon UTC is "today" for virtually every IANA zone on Earth.
 */
function noonUtcMs(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Date.UTC(y, m - 1, d, 12, 0, 0);
}

// ---------------------------------------------------------------------------
// createManualState
// ---------------------------------------------------------------------------

describe('createManualState', () => {
  it('returns a frozen state with the locked zone', () => {
    const state = createManualState(noonUtcMs('2025-06-15'), 'America/Chicago');
    assert.equal(state.zone, 'America/Chicago');
    assert.equal(state.totalMm, 0);
    assert.deepEqual(state.awards, { firstBadge: false, secondBadge: false, il01: false });
    assert.equal(state.postcardSent, false);
    assert.equal(Object.isFrozen(state), true);
  });

  it('throws for an invalid IANA zone', () => {
    assert.throws(
      () => createManualState(noonUtcMs('2025-06-15'), 'Mars/Olympus'),
      RangeError
    );
  });

  it('throws for a non-finite nowMs', () => {
    assert.throws(
      () => createManualState(NaN, 'UTC'),
      TypeError
    );
  });
});

// ---------------------------------------------------------------------------
// challengeDate — timezone day-boundary cases
// ---------------------------------------------------------------------------

describe('challengeDate — timezone day boundaries', () => {
  it('returns correct date for UTC', () => {
    // 2025-07-04 T 00:30 UTC
    const ms = Date.UTC(2025, 6, 4, 0, 30, 0);
    assert.equal(challengeDate(ms, 'UTC'), '2025-07-04');
  });

  it('returns previous calendar day for UTC-5 at 00:30 UTC (still July 3 locally)', () => {
    // 00:30 UTC on July 4 = 19:30 on July 3 in UTC-5 (America/New_York in winter;
    // use a fixed-offset zone for reliability)
    const ms = Date.UTC(2025, 6, 4, 0, 30, 0);
    // America/New_York is UTC-4 during DST in July — use Etc/GMT+5 (fixed UTC-5)
    assert.equal(challengeDate(ms, 'Etc/GMT+5'), '2025-07-03');
  });

  it('returns next calendar day for UTC+9 at 23:30 UTC', () => {
    // 23:30 UTC on July 3 = 08:30 on July 4 in UTC+9
    const ms = Date.UTC(2025, 6, 3, 23, 30, 0);
    assert.equal(challengeDate(ms, 'Asia/Tokyo'), '2025-07-04');
  });

  it('throws for an invalid zone', () => {
    assert.throws(
      () => challengeDate(noonUtcMs('2025-06-15'), 'Fake/Zone'),
      RangeError
    );
  });
});

// ---------------------------------------------------------------------------
// setManualDay — invalid canonical dates
// ---------------------------------------------------------------------------

describe('setManualDay — invalid canonical dates', () => {
  const state = createManualState(noonUtcMs('2025-06-01'), 'UTC');

  it('rejects Feb 30', () => {
    assert.throws(
      () => setManualDay(state, '2025-02-30', 100, noonUtcMs('2025-07-04')),
      RangeError
    );
  });

  it('rejects April 31', () => {
    assert.throws(
      () => setManualDay(state, '2025-04-31', 100, noonUtcMs('2025-07-04')),
      RangeError
    );
  });

  it('rejects month 13', () => {
    assert.throws(
      () => setManualDay(state, '2025-13-01', 100, noonUtcMs('2025-07-04')),
      RangeError
    );
  });

  it('rejects day 00', () => {
    assert.throws(
      () => setManualDay(state, '2025-06-00', 100, noonUtcMs('2025-07-04')),
      RangeError
    );
  });

  it('rejects non-ISO format', () => {
    assert.throws(
      () => setManualDay(state, '07/04/2025', 100, noonUtcMs('2025-07-04')),
      RangeError
    );
  });
});

// ---------------------------------------------------------------------------
// setManualDay — before activation and future rejection
// ---------------------------------------------------------------------------

describe('setManualDay — before activation and future', () => {
  const state = createManualState(noonUtcMs('2025-06-01'), 'UTC');

  it('rejects a date before activation (2025-05-31)', () => {
    assert.throws(
      () => setManualDay(state, '2025-05-31', 1000, noonUtcMs('2025-07-04')),
      RangeError
    );
  });

  it('rejects a date in the future', () => {
    assert.throws(
      () => setManualDay(state, '2025-12-31', 1000, noonUtcMs('2025-07-04')),
      RangeError
    );
  });

  it('accepts activation date itself (2025-06-01)', () => {
    const s2 = setManualDay(state, '2025-06-01', 50, noonUtcMs('2025-07-04'));
    assert.equal(s2.days['2025-06-01'], 50);
  });

  it('accepts today', () => {
    const s2 = setManualDay(state, '2025-07-04', 200, noonUtcMs('2025-07-04'));
    assert.equal(s2.days['2025-07-04'], 200);
  });
});

// ---------------------------------------------------------------------------
// setManualDay — step range validation
// ---------------------------------------------------------------------------

describe('setManualDay — step range', () => {
  const state = createManualState(noonUtcMs('2025-06-01'), 'UTC');

  it('rejects negative steps', () => {
    assert.throws(
      () => setManualDay(state, '2025-06-15', -1, noonUtcMs('2025-07-04')),
      RangeError
    );
  });

  it('rejects steps > 100 000', () => {
    assert.throws(
      () => setManualDay(state, '2025-06-15', 100_001, noonUtcMs('2025-07-04')),
      RangeError
    );
  });

  it('rejects non-integer steps', () => {
    assert.throws(
      () => setManualDay(state, '2025-06-15', 99.5, noonUtcMs('2025-07-04')),
      RangeError
    );
  });

  it('accepts 0 steps', () => {
    const s2 = setManualDay(state, '2025-06-15', 0, noonUtcMs('2025-07-04'));
    assert.equal(s2.days['2025-06-15'], 0);
  });

  it('accepts exactly 100 000 steps', () => {
    const s2 = setManualDay(state, '2025-06-15', 100_000, noonUtcMs('2025-07-04'));
    assert.equal(s2.days['2025-06-15'], 100_000);
  });
});

// ---------------------------------------------------------------------------
// setManualDay — immutability
// ---------------------------------------------------------------------------

describe('setManualDay — immutability', () => {
  it('does not mutate the original state', () => {
    const s1 = createManualState(noonUtcMs('2025-06-01'), 'UTC');
    const s2 = setManualDay(s1, '2025-06-15', 500, noonUtcMs('2025-07-04'));
    assert.equal(s1.totalMm, 0);
    assert.equal(s1.days['2025-06-15'], undefined);
    assert.equal(s2.totalMm, 500 * 700);
  });

  it('new state is also frozen', () => {
    const s1 = createManualState(noonUtcMs('2025-06-01'), 'UTC');
    const s2 = setManualDay(s1, '2025-06-15', 500, noonUtcMs('2025-07-04'));
    assert.equal(Object.isFrozen(s2), true);
  });
});

// ---------------------------------------------------------------------------
// setManualDay — overwrite
// ---------------------------------------------------------------------------

describe('setManualDay — overwrite', () => {
  it('overwrites a previous entry for the same date', () => {
    let state = createManualState(noonUtcMs('2025-06-01'), 'UTC');
    state = setManualDay(state, '2025-06-15', 1000, noonUtcMs('2025-07-04'));
    state = setManualDay(state, '2025-06-15', 2000, noonUtcMs('2025-07-04'));
    assert.equal(state.days['2025-06-15'], 2000);
    // totalMm reflects the overwrite, not accumulation
    assert.equal(state.totalMm, 2000 * 700);
  });

  it('no duplicate distance accumulation on overwrite', () => {
    let state = createManualState(noonUtcMs('2025-06-01'), 'UTC');
    state = setManualDay(state, '2025-06-10', 500, noonUtcMs('2025-07-04'));
    state = setManualDay(state, '2025-06-10', 500, noonUtcMs('2025-07-04'));
    assert.equal(state.totalMm, 500 * 700);   // not 1000 * 700
  });
});

// ---------------------------------------------------------------------------
// Awards — earned at correct thresholds, never revoked on downward correction
// ---------------------------------------------------------------------------

describe('awards — thresholds', () => {
  //  IL01 at 4 200 000 mm = 6 000 steps
  //  IL02 at 12 600 000 mm = 18 000 steps
  //  IL03 at 17 703 000 mm = 25 290 steps  (17 703 000 / 700)
  //  (25 290 exactly, since 25290 * 700 = 17 703 000)

  it('IL01 not awarded below threshold', () => {
    let state = createManualState(noonUtcMs('2025-06-01'), 'UTC');
    state = setManualDay(state, '2025-06-10', 5999, noonUtcMs('2025-07-04'));
    assert.equal(state.awards.firstBadge, false);
  });

  it('IL01 awarded at exactly 6 000 steps (one day)', () => {
    let state = createManualState(noonUtcMs('2025-06-01'), 'UTC');
    state = setManualDay(state, '2025-06-10', 6000, noonUtcMs('2025-07-04'));
    assert.equal(state.awards.firstBadge, true);
    assert.equal(state.awards.secondBadge, false);
    assert.equal(state.awards.il01, false);
  });

  it('IL02 awarded at exactly 18 000 steps across two days', () => {
    let state = createManualState(noonUtcMs('2025-06-01'), 'UTC');
    state = setManualDay(state, '2025-06-10', 9000, noonUtcMs('2025-07-04'));
    state = setManualDay(state, '2025-06-11', 9000, noonUtcMs('2025-07-04'));
    assert.equal(state.awards.firstBadge, true);
    assert.equal(state.awards.secondBadge, true);
    assert.equal(state.awards.il01, false);
  });

  it('IL03 awarded at exactly 25 290 steps', () => {
    let state = createManualState(noonUtcMs('2025-06-01'), 'UTC');
    state = setManualDay(state, '2025-06-10', 25_290, noonUtcMs('2025-07-04'));
    assert.equal(state.awards.firstBadge, true);
    assert.equal(state.awards.secondBadge, true);
    assert.equal(state.awards.il01, true);
  });
});

describe('awards — no revocation on downward correction', () => {
  it('IL01 stays earned after steps corrected down below threshold', () => {
    let state = createManualState(noonUtcMs('2025-06-01'), 'UTC');
    // Push over IL01
    state = setManualDay(state, '2025-06-10', 6000, noonUtcMs('2025-07-04'));
    assert.equal(state.awards.firstBadge, true);
    // Correct down — total drops below 4 200 000 mm
    state = setManualDay(state, '2025-06-10', 100, noonUtcMs('2025-07-04'));
    assert.equal(state.awards.firstBadge, true);   // must NOT be revoked
    assert.equal(state.totalMm, 100 * 700);  // distance is recalculated honestly
  });

  it('IL02 and IL01 stay after downward correction below IL02', () => {
    let state = createManualState(noonUtcMs('2025-06-01'), 'UTC');
    state = setManualDay(state, '2025-06-10', 18_000, noonUtcMs('2025-07-04'));
    assert.equal(state.awards.secondBadge, true);
    state = setManualDay(state, '2025-06-10', 10, noonUtcMs('2025-07-04'));
    assert.equal(state.awards.firstBadge, true);
    assert.equal(state.awards.secondBadge, true);
  });

  it('each award only earned once — repeated entry at same level does not duplicate', () => {
    let state = createManualState(noonUtcMs('2025-06-01'), 'UTC');
    state = setManualDay(state, '2025-06-10', 6000, noonUtcMs('2025-07-04'));
    state = setManualDay(state, '2025-06-11', 6000, noonUtcMs('2025-07-04'));
    // IL01 is true (bool), not a counter — the value never changes from true
    assert.equal(state.awards.firstBadge, true);
    assert.equal(typeof state.awards.firstBadge, 'boolean');
  });
});

// ---------------------------------------------------------------------------
// saveManualPostcard
// ---------------------------------------------------------------------------

describe('saveManualPostcard', () => {
  it('throws when IL01 not yet earned', () => {
    const state = createManualState(noonUtcMs('2025-06-01'), 'UTC');
    assert.throws(() => saveManualPostcard(state), /IL01/);
  });

  it('marks postcardSent after IL01', () => {
    let state = createManualState(noonUtcMs('2025-06-01'), 'UTC');
    state = setManualDay(state, '2025-06-10', 25290, noonUtcMs('2025-07-04'));
    const sent = saveManualPostcard(state);
    assert.equal(sent.postcardSent, true);
    assert.equal(Object.isFrozen(sent), true);
  });

  it('is idempotent — calling twice does not throw or change state', () => {
    let state = createManualState(noonUtcMs('2025-06-01'), 'UTC');
    state = setManualDay(state, '2025-06-10', 25290, noonUtcMs('2025-07-04'));
    const sent1 = saveManualPostcard(state);
    const sent2 = saveManualPostcard(sent1);
    assert.equal(sent2.postcardSent, true);
    assert.deepEqual(sent2.awards, sent1.awards);
  });

  it('does not send postcard on original state (immutability)', () => {
    let state = createManualState(noonUtcMs('2025-06-01'), 'UTC');
    state = setManualDay(state, '2025-06-10', 25290, noonUtcMs('2025-07-04'));
    saveManualPostcard(state);
    assert.equal(state.postcardSent, false);  // original untouched
  });
});

// ---------------------------------------------------------------------------
// Demo isolation — Demo input does not affect real state
// ---------------------------------------------------------------------------

describe('Demo input isolation', () => {
  it('a demo state has no effect on a separately created real state', () => {
    const realState  = createManualState(noonUtcMs('2025-06-01'), 'UTC');
    const demoState  = createManualState(noonUtcMs('2025-06-01'), 'UTC');

    // Mutate demo heavily
    let demo = setManualDay(demoState, '2025-06-10', 100_000, noonUtcMs('2025-07-04'));
    demo = saveManualPostcard(demo);

    // Real state is untouched
    assert.equal(realState.totalMm, 0);
    assert.equal(realState.postcardSent, false);
    assert.equal(realState.awards.firstBadge, false);
  });

  it('demo state variables are independent value objects', () => {
    const s1 = createManualState(noonUtcMs('2025-06-01'), 'UTC');
    const s2 = createManualState(noonUtcMs('2025-07-04'), 'America/Los_Angeles');

    // Modify s1
    const s1b = setManualDay(s1, '2025-06-10', 5000, noonUtcMs('2025-07-04'));

    // s2 is completely independent
    assert.equal(s2.totalMm, 0);
    assert.equal(s2.zone, 'America/Los_Angeles');
    assert.equal(s1b.zone, 'UTC');
  });
});

// ---------------------------------------------------------------------------
// Timezone day-boundary: future/past flips at zone midnight
// ---------------------------------------------------------------------------

describe('setManualDay — timezone boundary future/past flip', () => {
  it('rejects tomorrow in UTC+9 when UTC says it is still today', () => {
    // 2025-07-04 T 15:00 UTC = 2025-07-05 T 00:00 JST (Asia/Tokyo, UTC+9)
    // If zone is Tokyo, today is 2025-07-05; 2025-07-06 is future → reject.
    const msAt15UTC = Date.UTC(2025, 6, 4, 15, 0, 0);
    const tokyoState = createManualState(msAt15UTC, 'Asia/Tokyo');
    // today in Tokyo is 2025-07-05
    assert.throws(
      () => setManualDay(tokyoState, '2025-07-06', 100, msAt15UTC),
      RangeError
    );
  });

  it('accepts today in UTC+9 that is tomorrow in UTC', () => {
    // 2025-07-04 T 15:00 UTC → today in Tokyo is 2025-07-05
    const msAt15UTC = Date.UTC(2025, 6, 4, 15, 0, 0);
    const tokyoState = createManualState(msAt15UTC, 'Asia/Tokyo');
    const s2 = setManualDay(tokyoState, '2025-07-05', 300, msAt15UTC);
    assert.equal(s2.days['2025-07-05'], 300);
  });

  it('rejects a date that is today in UTC but future in UTC-12', () => {
    // 2025-07-04 T 01:00 UTC → in Etc/GMT+12 it is still 2025-07-03
    const msAt01UTC = Date.UTC(2025, 6, 4, 1, 0, 0);
    const westState = createManualState(msAt01UTC, 'Etc/GMT+12');
    // 2025-07-04 is future from that zone's perspective
    assert.throws(
      () => setManualDay(westState, '2025-07-04', 100, msAt01UTC),
      RangeError
    );
  });
});

it('fixes activation to the start day in the challenge zone', () => {
  const now = Date.UTC(2026, 10, 23, 3, 30);
  const state = createManualState(now, 'America/Vancouver');
  assert.equal(state.activatedOn, '2026-11-22');
  assert.throws(() => setManualDay(state, '2026-11-21', 4, now), /before activation/);
  assert.throws(() => setManualDay(state, '2026-11-23', 4, now), /future/);
  const crossed = setManualDay(state, '2026-11-22', 25_290, now);
  const saved = saveManualPostcard(crossed);
  const corrected = setManualDay(saved, '2026-11-22', 5_999, now);
  assert.equal(corrected.totalMm, 4_199_300);
  assert.equal(corrected.postcardSent, true);
  assert.deepEqual(corrected.awards, { firstBadge:true, secondBadge:true, il01:true });
  assert.equal(saveManualPostcard(corrected), corrected);
});
it('will not allow saving a postcard at only the first badge', () => {
  const now=Date.UTC(2026,10,23);
  const state=setManualDay(createManualState(now,'UTC'),'2026-11-23',6000,now);
  assert.throws(() => saveManualPostcard(state), /IL01/);
});
