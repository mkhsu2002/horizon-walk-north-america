/**
 * manual-engine.mjs
 *
 * Standalone pure manual-challenge ledger.
 * No dependencies. Browser-compatible (no Node built-ins).
 *
 * Units
 *   distance  : mm   (1 step = 700 mm)
 *   thresholds: 4 200 000 mm | 12 600 000 mm | 17 703 000 mm
 *
 * Activation date is fixed when the challenge starts.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MM_PER_STEP       = 700;
const AWARD_THRESHOLDS  = [4_200_000, 12_600_000, 17_703_000];
const AWARD_KEYS        = ['firstBadge', 'secondBadge', 'il01'];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Derive an ISO YYYY-MM-DD date string from `now` (ms since epoch)
 * using the given IANA zone, via Intl.DateTimeFormat.formatToParts.
 * Returns a string like '2025-07-04'.
 */
function _isoDateInZone(nowMs, zone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone : zone,
    year     : 'numeric',
    month    : '2-digit',
    day      : '2-digit',
  }).formatToParts(new Date(nowMs));

  const get = (type) => parts.find((p) => p.type === type).value;
  // en-CA formats as YYYY-MM-DD natively; still assemble explicitly for safety
  return `${get('year').padStart(4, '0')}-${get('month')}-${get('day')}`;
}

/**
 * Validate that `zone` is a real IANA time-zone identifier supported by
 * this runtime's Intl implementation.  Throws if not.
 */
function _validateZone(zone) {
  if (typeof zone !== 'string' || zone.trim() === '' || /^[+-]/.test(zone)) {
    throw new RangeError('zone must be a non-empty string');
  }
  // Intl throws a RangeError for unknown identifiers.
  new Intl.DateTimeFormat('en-CA', { timeZone: zone });
}

/**
 * Returns true iff `date` is a canonical ISO YYYY-MM-DD string that round-
 * trips through Intl without rolling over (e.g. '2025-02-30' is rejected).
 * Does NOT rely on Date.parse semantics.
 */
function _isCanonicalDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }
  const [y, m, d] = date.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;

  // Reconstruct via Intl using UTC, then compare.
  // We build a UTC midnight for the given values and check the UTC date.
  if (y < 1) return false;
  const candidate = new Date(0);
  candidate.setUTCFullYear(y, m - 1, d);
  const rebuilt = new Intl.DateTimeFormat('en-CA', {
    timeZone : 'UTC',
    year     : 'numeric',
    month    : '2-digit',
    day      : '2-digit',
  }).formatToParts(new Date(candidate));
  const get = (type) => rebuilt.find((p) => p.type === type).value;
  const roundTrip = `${get('year').padStart(4, '0')}-${get('month')}-${get('day')}`;
  return roundTrip === date;
}

/**
 * Compare two ISO YYYY-MM-DD strings lexicographically (valid for ISO dates).
 * Returns -1 | 0 | 1.
 */
function _cmpDate(a, b) {
  if (a < b) return -1;
  if (a > b) return  1;
  return 0;
}

/**
 * Recompute awards from scratch given total mm, preserving any awards that
 * were already earned (never revoke).
 */
function _recomputeAwards(currentAwards, totalMm) {
  const next = { ...currentAwards };
  for (let i = 0; i < AWARD_THRESHOLDS.length; i++) {
    if (!next[AWARD_KEYS[i]] && totalMm >= AWARD_THRESHOLDS[i]) {
      next[AWARD_KEYS[i]] = true;
    }
    // Once earned, never cleared — the spread already preserved truthy values.
  }
  return next;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * createManualState(nowMs, zone)
 *
 * Create an initial ledger state.
 *
 * @param {number} nowMs  - Current time as ms-since-epoch (injected clock).
 * @param {string} zone   - IANA time-zone identifier (locked for the session).
 * @returns {Readonly<object>} Immutable state object.
 */
export function createManualState(nowMs, zone) {
  if (!Number.isFinite(nowMs)) {
    throw new TypeError('nowMs must be a finite number');
  }
  _validateZone(zone);   // throws RangeError for unknown zone

  return Object.freeze({
    zone,
    activatedOn: _isoDateInZone(nowMs, zone),
    days      : Object.freeze({}),   // keyed by YYYY-MM-DD
    totalMm   : 0,
    awards    : Object.freeze({ firstBadge: false, secondBadge: false, il01: false }),
    postcardSent: false,
  });
}

/**
 * challengeDate(nowMs, zone)
 *
 * Return today's date string in `zone` as ISO YYYY-MM-DD,
 * derived purely from Intl.formatToParts (no string parsing of Date).
 *
 * @param {number} nowMs
 * @param {string} zone
 * @returns {string}
 */
export function challengeDate(nowMs, zone) {
  if (!Number.isFinite(nowMs)) {
    throw new TypeError('nowMs must be a finite number');
  }
  _validateZone(zone);
  return _isoDateInZone(nowMs, zone);
}

/**
 * setManualDay(state, date, steps, nowMs)
 *
 * Record (or overwrite) a day's step count.  Returns a new frozen state;
 * the original is never mutated.
 *
 * Rules
 *   - `date`  must be a canonical YYYY-MM-DD (no rollover accepted).
 *   - `steps` must be a non-negative safe integer ≤ 100 000.
 *   - `date`  must be ≥ state.activatedOn.
 *   - `date`  must be ≤ today in `state.zone` (no future entries).
 *   - Overwrite is allowed; awards already earned are never revoked.
 *
 * @param {Readonly<object>} state
 * @param {string}           date   YYYY-MM-DD
 * @param {number}           steps  integer 0–100 000
 * @param {number}           nowMs  injected clock (ms since epoch)
 * @returns {Readonly<object>} New immutable state.
 */
export function setManualDay(state, date, steps, nowMs) {
  // --- validate steps ---
  if (
    typeof steps !== 'number' ||
    !Number.isSafeInteger(steps) ||
    steps < 0 ||
    steps > 100_000
  ) {
    throw new RangeError('steps must be a non-negative safe integer ≤ 100 000');
  }

  // --- validate date format and canonicality ---
  if (!_isCanonicalDate(date)) {
    throw new RangeError(`"${date}" is not a valid canonical date`);
  }

  // --- activation lower bound ---
  if (_cmpDate(date, state.activatedOn) < 0) {
    throw new RangeError(
      `date ${date} is before activation date ${state.activatedOn}`
    );
  }

  // --- reject future dates using zone-aware today ---
  if (!Number.isFinite(nowMs)) {
    throw new TypeError('nowMs must be a finite number');
  }
  const today = _isoDateInZone(nowMs, state.zone);
  if (_cmpDate(date, today) > 0) {
    throw new RangeError(
      `date ${date} is in the future (today is ${today} in ${state.zone})`
    );
  }

  // --- build new days map (overwrite allowed) ---
  const newDays = Object.freeze({ ...state.days, [date]: steps });

  // --- recompute total mm ---
  const totalMm = Object.values(newDays).reduce(
    (sum, s) => sum + s * MM_PER_STEP,
    0
  );

  // --- update awards (never revoke) ---
  if (!Number.isSafeInteger(totalMm)) throw new RangeError('Total distance is outside the safe range');
  const awards = Object.freeze(_recomputeAwards(state.awards, totalMm));

  return Object.freeze({
    zone        : state.zone,
    activatedOn : state.activatedOn,
    days        : newDays,
    totalMm,
    awards,
    postcardSent: state.postcardSent,
  });
}

/**
 * saveManualPostcard(state)
 *
 * Mark the postcard as sent once IL01 is earned.
 * Returns a new frozen state.  Calling it again after the postcard is already
 * sent is a no-op (returns the same shape, postcardSent stays true).
 *
 * @param {Readonly<object>} state
 * @returns {Readonly<object>}
 */
export function saveManualPostcard(state) {
  if (!state.awards.il01) {
    throw new Error('saveManualPostcard requires IL01 to be earned first');
  }
  if (state.postcardSent) {
    // Idempotent: already sent — return unchanged shape.
    return state;
  }
  return Object.freeze({
    zone        : state.zone,
    activatedOn : state.activatedOn,
    days        : state.days,
    totalMm     : state.totalMm,
    awards      : state.awards,
    postcardSent: true,
  });
}
