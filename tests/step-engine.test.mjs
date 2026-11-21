/**
 * step-engine.test.mjs
 *
 * Node built-in test runner (node:test).
 * Run with: node --test step-engine.test.mjs
 *
 * Coverage:
 *   - 5 999 steps → no milestone; 6 000 steps → first milestone (4 200 000 mm)
 *   - 18 000 cumulative steps → second milestone (12 600 000 mm)
 *   - 25 289 cumulative steps → no third milestone; 25 290 → third (17 703 000 mm)
 *   - Duplicate batch ID → replay ignored, state unchanged, no double-award
 *   - Single batch crosses multiple milestones at once
 *   - Invalid inputs (bad id, negative steps, non-integer steps)
 *   - Overflow rejection
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createState, applyBatch } from "../web/step-engine.mjs";

const STEP_MM = 700;
const MILE_1 = 4_200_000;
const MILE_2 = 12_600_000;
const MILE_3 = 17_703_000;

// ---------------------------------------------------------------------------
// Helper: apply many steps as a single batch
// ---------------------------------------------------------------------------
function batch(state, id, steps) {
  return applyBatch(state, { id, steps });
}

// ---------------------------------------------------------------------------
// Milestone 1: boundary at 6 000 steps (4 200 000 mm)
// ---------------------------------------------------------------------------
test("5999 steps: no milestone awarded", () => {
  let s = createState();
  const { state, newAwards } = batch(s, "b1", 5_999);
  assert.equal(state.totalMm, 5_999 * STEP_MM);
  assert.deepEqual(newAwards, []);
  assert.equal(state.awarded.size, 0);
});

test("6000 steps: milestone 1 awarded", () => {
  let s = createState();
  const { state, newAwards } = batch(s, "b1", 6_000);
  assert.equal(state.totalMm, 6_000 * STEP_MM);
  assert.deepEqual(newAwards, [MILE_1]);
  assert.ok(state.awarded.has(MILE_1));
});

test("5999 then 1 more step: milestone 1 awarded on crossing batch", () => {
  let s = createState();
  ({ state: s } = batch(s, "b1", 5_999));
  const { state, newAwards } = batch(s, "b2", 1);
  assert.equal(state.totalMm, 6_000 * STEP_MM);
  assert.deepEqual(newAwards, [MILE_1]);
});

// ---------------------------------------------------------------------------
// Milestone 2: boundary at 18 000 cumulative steps (12 600 000 mm)
// ---------------------------------------------------------------------------
test("18000 cumulative steps: milestone 2 awarded", () => {
  let s = createState();
  ({ state: s } = batch(s, "b1", 6_000));   // earns milestone 1
  ({ state: s } = batch(s, "b2", 12_000));  // reaches 18 000 total
  assert.equal(s.totalMm, 18_000 * STEP_MM);
  assert.ok(s.awarded.has(MILE_2));
});

test("17999 cumulative steps: no milestone 2 yet", () => {
  let s = createState();
  ({ state: s } = batch(s, "b1", 17_999));
  assert.ok(!s.awarded.has(MILE_2));
});

// ---------------------------------------------------------------------------
// Milestone 3: boundary at 25 290 steps (17 703 000 mm)
//   ceil(17703000 / 700) = 25290 exactly (17703000 % 700 == 0)
// ---------------------------------------------------------------------------
test("25289 cumulative steps: no milestone 3", () => {
  let s = createState();
  ({ state: s } = batch(s, "b1", 25_289));
  assert.ok(!s.awarded.has(MILE_3));
});

test("25290 cumulative steps: milestone 3 awarded", () => {
  let s = createState();
  ({ state: s } = batch(s, "b1", 25_290));
  assert.ok(s.awarded.has(MILE_3));
  assert.equal(s.totalMm, 25_290 * STEP_MM);
});

test("25289 then 1 more step: milestone 3 awarded on crossing batch", () => {
  let s = createState();
  ({ state: s } = batch(s, "b1", 25_289));
  const { state, newAwards } = batch(s, "b2", 1);
  assert.deepEqual(newAwards, [MILE_3]);
  assert.ok(state.awarded.has(MILE_3));
});

// ---------------------------------------------------------------------------
// Duplicate batch ID → idempotent replay
// ---------------------------------------------------------------------------
test("duplicate batch id: state unchanged, no award", () => {
  let s = createState();
  ({ state: s } = batch(s, "dup", 5_999));
  const stateBefore = s;

  const { state: stateAfter, newAwards } = batch(s, "dup", 5_999);
  assert.equal(stateAfter, stateBefore);        // exact same object reference
  assert.deepEqual(newAwards, []);
  assert.equal(stateAfter.totalMm, 5_999 * STEP_MM);
});

test("duplicate batch id does not re-award milestone", () => {
  let s = createState();
  ({ state: s } = batch(s, "m1", 6_000));        // awards MILE_1
  assert.ok(s.awarded.has(MILE_1));

  const { state, newAwards } = batch(s, "m1", 0); // replay
  assert.deepEqual(newAwards, []);
  assert.equal(state, s);                          // unchanged
});

// ---------------------------------------------------------------------------
// Single batch crosses multiple milestones
// ---------------------------------------------------------------------------
test("one batch crosses all three milestones", () => {
  let s = createState();
  const { state, newAwards } = batch(s, "big", 25_290);
  assert.deepEqual(newAwards, [MILE_1, MILE_2, MILE_3]);
  assert.equal(state.awarded.size, 3);
});

// ---------------------------------------------------------------------------
// Milestones awarded at most once
// ---------------------------------------------------------------------------
test("milestone not re-awarded on subsequent batches", () => {
  let s = createState();
  ({ state: s } = batch(s, "b1", 6_000));   // awards MILE_1
  const { newAwards } = batch(s, "b2", 1);  // goes past MILE_1 again (already awarded)
  assert.ok(!newAwards.includes(MILE_1));
});

// ---------------------------------------------------------------------------
// Invalid input rejection
// ---------------------------------------------------------------------------
test("empty string id throws TypeError", () => {
  const s = createState();
  assert.throws(() => applyBatch(s, { id: "", steps: 1 }), TypeError);
});

test("non-string id throws TypeError", () => {
  const s = createState();
  assert.throws(() => applyBatch(s, { id: 42, steps: 1 }), TypeError);
});

test("negative steps throws RangeError", () => {
  const s = createState();
  assert.throws(() => applyBatch(s, { id: "x", steps: -1 }), RangeError);
});

test("fractional steps throws RangeError", () => {
  const s = createState();
  assert.throws(() => applyBatch(s, { id: "x", steps: 1.5 }), RangeError);
});

test("zero steps accepted, nothing awarded", () => {
  const s = createState();
  const { state, newAwards } = applyBatch(s, { id: "z", steps: 0 });
  assert.equal(state.totalMm, 0);
  assert.deepEqual(newAwards, []);
});

// ---------------------------------------------------------------------------
// Overflow rejection
// ---------------------------------------------------------------------------
test("steps that overflow safe integer are rejected atomically", () => {
  const s = createState();
  // Number.MAX_SAFE_INTEGER / 700 ≈ 12 892 985 879 453; use MAX_SAFE_INTEGER directly
  const tooBig = Number.MAX_SAFE_INTEGER; // steps * 700 overflows
  assert.throws(() => applyBatch(s, { id: "over", steps: tooBig }), RangeError);
});

test("overflow rejected: state not mutated", () => {
  let s = createState();
  // bring totalMm close to MAX_SAFE_INTEGER
  const nearMax = Math.floor(Number.MAX_SAFE_INTEGER / STEP_MM) - 1;
  ({ state: s } = batch(s, "setup", nearMax));
  const mmBefore = s.totalMm;

  assert.throws(() => applyBatch(s, { id: "boom", steps: 10 }), RangeError);
  assert.equal(s.totalMm, mmBefore); // original state object unchanged
});
