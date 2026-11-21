/**
 * step-engine.mjs
 *
 * Pure ES module, no dependencies beyond JS built-ins.
 *
 * Units: all distances in integer millimetres.
 * One step = 700 mm (exact integer arithmetic throughout).
 *
 * Milestones (one-time awards, mm):
 *   MILE_1 =  4 200 000  (~6 000 steps)
 *   MILE_2 = 12 600 000  (~18 000 steps)
 *   MILE_3 = 17 703 000  (~25 290 steps)
 */

const STEP_MM = 700; // millimetres per step (integer)

const MILESTONES = [4_200_000, 12_600_000, 17_703_000];

/**
 * Create a fresh state object.
 *
 * @returns {{
 *   totalMm: number,        // cumulative distance in mm (safe integer)
 *   seenIds: Set<string>,   // batch IDs already applied
 *   awarded: Set<number>    // milestone mm values already awarded
 * }}
 */
export function createState() {
  return {
    totalMm: 0,
    seenIds: new Set(),
    awarded: new Set(),
  };
}

/**
 * Apply a batch of steps to the state immutably.
 *
 * Rules:
 * - `id` must be a non-empty string.
 * - `steps` must be a non-negative safe integer.
 * - A batch whose `id` has already been seen is silently ignored (idempotent
 *   replay): the returned state is identical to the input state, no steps
 *   added, no awards granted.
 * - If adding steps would cause totalMm to exceed Number.MAX_SAFE_INTEGER the
 *   entire batch is rejected atomically (state unchanged, error thrown).
 * - Milestones are awarded exactly once, the first time totalMm reaches or
 *   crosses the threshold, even when a single batch crosses multiple.
 *
 * @param {{ totalMm: number, seenIds: Set<string>, awarded: Set<number> }} state
 * @param {{ id: string, steps: number }} batch
 * @returns {{
 *   state: { totalMm: number, seenIds: Set<string>, awarded: Set<number> },
 *   newAwards: number[]   // milestone mm values awarded in this batch
 * }}
 */
export function applyBatch(state, { id, steps }) {
  // --- validate inputs ---
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("batch id must be a non-empty string");
  }
  if (
    !Number.isSafeInteger(steps) ||
    steps < 0
  ) {
    throw new RangeError("steps must be a non-negative safe integer");
  }

  // --- duplicate / replay guard ---
  if (state.seenIds.has(id)) {
    return { state, newAwards: [] };
  }

  // --- overflow guard (atomic) ---
  const addedMm = steps * STEP_MM; // steps and STEP_MM are both safe integers;
                                    // product is safe as long as steps ≤ MAX_SAFE_INTEGER/700
  if (!Number.isSafeInteger(addedMm)) {
    throw new RangeError(
      `batch rejected: steps (${steps}) * ${STEP_MM} mm overflows safe integer`
    );
  }
  const nextMm = state.totalMm + addedMm;
  if (!Number.isSafeInteger(nextMm)) {
    throw new RangeError(
      `batch rejected: resulting totalMm (${nextMm}) overflows safe integer`
    );
  }

  // --- compute new awards ---
  const newAwards = MILESTONES.filter(
    (mm) => !state.awarded.has(mm) && nextMm >= mm
  );

  // --- build next state (shallow-copy collections) ---
  const nextSeenIds = new Set(state.seenIds);
  nextSeenIds.add(id);

  const nextAwarded = new Set(state.awarded);
  for (const mm of newAwards) nextAwarded.add(mm);

  const nextState = {
    totalMm: nextMm,
    seenIds: nextSeenIds,
    awarded: nextAwarded,
  };

  return { state: nextState, newAwards };
}
