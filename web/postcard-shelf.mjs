/**
 * postcard-shelf.mjs
 * Pure logic for Route 66 Illinois postcard shelf.
 * No browser I/O, no storage writes, no wall clock.
 */

import { ILLINOIS_STOPS } from './route-catalog.mjs';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Canonical stop order: IL01..IL12 (no IL00). */
const ORDERED_STOPS = ILLINOIS_STOPS
  .filter(s => s.id !== 'IL00')
  .sort((a, b) => a.meters - b.meters);

const STOP_IDS = new Set(ORDERED_STOPS.map(s => s.id));

const VALID_MODES = new Set(['Demo', 'Manual']);

function assertMode(mode) {
  if (!VALID_MODES.has(mode)) {
    throw new Error(`Unknown mode: "${mode}". Must be "Demo" or "Manual".`);
  }
}

function assertShelfMode(shelf, mode) {
  if (shelf?.mode !== mode) {
    throw new Error(`Mode mismatch: shelf is "${shelf?.mode}", operation uses "${mode}".`);
  }
}

/** Return a new array with value appended if not already present, preserving canonical order. */
function addCanonical(arr, id) {
  if (arr.includes(id)) return arr;
  const merged = [...arr, id];
  return ORDERED_STOPS.map(s => s.id).filter(i => merged.includes(i));
}

function assertMm(mm) {
  if (!Number.isSafeInteger(mm) || mm < 0) {
    throw new RangeError('totalMm must be a nonnegative safe integer');
  }
}

function same(a, b) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the localStorage key for the given mode.
 * 'Demo'   → 'horizon.route66.postcards.v1.demo'
 * 'Manual' → 'horizon.route66.postcards.v1.manual'
 */
export function shelfStorageKey(mode) {
  assertMode(mode);
  return `horizon.route66.postcards.v1.${mode.toLowerCase()}`;
}

/**
 * Creates an empty shelf for the given mode.
 * Returns a plain JSON-friendly object.
 */
export function createShelf(mode) {
  assertMode(mode);
  return { mode, earned: [], saved: [] };
}

/**
 * Syncs the shelf against totalMm, returning a new shelf (immutable).
 *
 * Rules:
 *  - totalMm must be a nonnegative safe integer.
 *  - A stop is eligible when totalMm >= threshold (exact boundary counts).
 *  - earned is monotonic: previously earned stops are never removed.
 *  - New stops earned only from current threshold eligibility OR explicit legacyIL01Earned.
 *  - saved cards persist alongside their monotonic earned claims. Malformed saved-only
 *    entries are ignored; this function never changes the previous object or browser storage.
 *  - legacyIL01Earned: if true, IL01 is added to earned regardless of distance.
 *  - legacyIL01Saved:  if true, IL01 is added to saved ONLY IF it is already in earned
 *    (either by threshold, legacy earned flag, or prior earned state).
 */
export function syncShelf(shelf, mode, totalMm, {
  legacyIL01Earned = false,
  legacyIL01Saved = false,
} = {}) {
  assertMode(mode);
  assertShelfMode(shelf, mode);

  assertMm(totalMm);

  // 1. Determine earned set: start from prior earned (monotonic).
  const earnedSet = new Set(shelf.earned);

  // 2. Add any stop newly crossed by threshold.
  for (const stop of ORDERED_STOPS) {
    if (totalMm >= stop.meters * 1000) {
      earnedSet.add(stop.id);
    }
  }

  // 3. Apply legacy earned flag for IL01.
  if (legacyIL01Earned === true && STOP_IDS.has('IL01')) {
    earnedSet.add('IL01');
  }

  // 4. Build canonical earned array.
  const earned = ORDERED_STOPS.map(s => s.id).filter(id => earnedSet.has(id));

  // 5. Carry over existing saved (persist regardless).
  const savedSet = new Set(shelf.saved.filter(id => earnedSet.has(id)));

  // 6. Apply legacy saved flag: only if IL01 is already earned.
  if (legacyIL01Saved === true && earnedSet.has('IL01') && STOP_IDS.has('IL01')) {
    savedSet.add('IL01');
  }

  // 7. Remove any saved entries that are not known stops (defensive).
  for (const id of savedSet) {
    if (!STOP_IDS.has(id)) savedSet.delete(id);
  }

  // 8. Build canonical saved array.
  const saved = ORDERED_STOPS.map(s => s.id).filter(id => savedSet.has(id));

  return same(shelf.earned, earned) && same(shelf.saved, saved) ? shelf : { mode, earned, saved };
}

/**
 * Records that the user saved a postcard for stop `id`.
 * No-op if the stop is unknown, is IL00, or is not in earned.
 * No-op if already saved.
 * Returns a new shelf (immutable).
 */
export function savePostcard(shelf, mode, id) {
  assertMode(mode);
  assertShelfMode(shelf, mode);

  if (!STOP_IDS.has(id)) return shelf;          // unknown or IL00
  if (!shelf.earned.includes(id)) return shelf;  // not yet earned (locked)
  if (shelf.saved.includes(id)) return shelf;    // already saved

  return { ...shelf, saved: addCanonical(shelf.saved, id) };
}
