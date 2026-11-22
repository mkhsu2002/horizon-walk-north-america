import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ILLINOIS_STOPS, routeProgress } from "../web/route-catalog.mjs";

// ---------------------------------------------------------------------------
// ILLINOIS_STOPS shape
// ---------------------------------------------------------------------------

describe("ILLINOIS_STOPS", () => {
  it("contains exactly 13 stops", () => {
    assert.equal(ILLINOIS_STOPS.length, 13);
  });

  it("every stop has id, name, meters (integer ≥ 0), and teaser", () => {
    for (const stop of ILLINOIS_STOPS) {
      assert.ok(typeof stop.id === "string" && stop.id.length > 0, `${stop.id} id`);
      assert.ok(typeof stop.name === "string" && stop.name.length > 0, `${stop.id} name`);
      assert.ok(Number.isInteger(stop.meters) && stop.meters >= 0, `${stop.id} meters`);
      assert.ok(typeof stop.teaser === "string" && stop.teaser.length > 0, `${stop.id} teaser`);
    }
  });

  it("stops are ordered by ascending meters", () => {
    for (let i = 1; i < ILLINOIS_STOPS.length; i++) {
      assert.ok(
        ILLINOIS_STOPS[i].meters > ILLINOIS_STOPS[i - 1].meters,
        `Stop ${i} not in order`
      );
    }
  });

  it("first stop is IL00 Chicago at 0 m", () => {
    assert.equal(ILLINOIS_STOPS[0].id, "IL00");
    assert.equal(ILLINOIS_STOPS[0].name, "Chicago");
    assert.equal(ILLINOIS_STOPS[0].meters, 0);
  });

  it("last stop is IL12 Old Chain of Rocks Bridge · Illinois Side at 531084 m", () => {
    const last = ILLINOIS_STOPS[12];
    assert.equal(last.id, "IL12");
    assert.equal(last.name, "Old Chain of Rocks Bridge · Illinois Side");
    assert.equal(last.meters, 531084);
  });
});

// ---------------------------------------------------------------------------
// routeProgress – boundary around first stop (IL01 at 17703 m = 17703000 mm)
// ---------------------------------------------------------------------------

describe("routeProgress – millimeter boundary at IL01", () => {
  it("1 mm before IL01 (17702999 mm) → current IL00, next IL01", () => {
    const p = routeProgress(17702999);
    assert.equal(p.current.id, "IL00");
    assert.equal(p.next.id, "IL01");
    assert.equal(p.remainingToNextMm, 1);
  });

  it("exactly at IL01 (17703000 mm) → current IL01, next IL02", () => {
    const p = routeProgress(17703000);
    assert.equal(p.current.id, "IL01");
    assert.equal(p.next.id, "IL02");
  });
});

// ---------------------------------------------------------------------------
// routeProgress – next / finish behaviour
// ---------------------------------------------------------------------------

describe("routeProgress – next and finish values", () => {
  it("at start (0 mm): current IL00, next IL01, remainingToFinish = 531084000 mm", () => {
    const p = routeProgress(0);
    assert.equal(p.current.id, "IL00");
    assert.equal(p.next.id, "IL01");
    assert.equal(p.remainingToFinishMm, 531084000);
  });

  it("at exact finish (531084000 mm): next is null, remainingToNextMm is null, remainingToFinishMm is 0", () => {
    const p = routeProgress(531084000);
    assert.equal(p.current.id, "IL12");
    assert.equal(p.next, null);
    assert.equal(p.remainingToNextMm, null);
    assert.equal(p.remainingToFinishMm, 0);
  });

  it("past finish (600000000 mm): next is null, remainingToFinishMm is 0", () => {
    const p = routeProgress(600000000);
    assert.equal(p.current.id, "IL12");
    assert.equal(p.next, null);
    assert.equal(p.remainingToNextMm, null);
    assert.equal(p.remainingToFinishMm, 0);
  });
});

// ---------------------------------------------------------------------------
// routeProgress – invalid inputs
// ---------------------------------------------------------------------------

describe("routeProgress – invalid inputs", () => {
  it("throws on negative integer", () => {
    assert.throws(() => routeProgress(-1), RangeError);
  });

  it("throws on float", () => {
    assert.throws(() => routeProgress(1234.5), RangeError);
  });

  it("throws on NaN", () => {
    assert.throws(() => routeProgress(NaN), RangeError);
  });

  it("throws on Infinity", () => {
    assert.throws(() => routeProgress(Infinity), RangeError);
  });

  it("throws on string", () => {
    assert.throws(() => routeProgress("1000"), RangeError);
  });

  it("throws on null", () => {
    assert.throws(() => routeProgress(null), RangeError);
  });

  it("throws on undefined", () => {
    assert.throws(() => routeProgress(undefined), RangeError);
  });

  it("throws on Number.MAX_SAFE_INTEGER + 1 (unsafe integer)", () => {
    assert.throws(() => routeProgress(Number.MAX_SAFE_INTEGER + 1), RangeError);
  });
});

it('named CTA uses integer ceiling and never redirects a stale click', async () => {
  const {demoStepsToVisibleStop}=await import('../web/route-catalog.mjs');
  assert.equal(demoStepsToVisibleStop(0,'IL01'),25290);
  assert.equal(demoStepsToVisibleStop(0,'IL02'),0);
  assert.equal(demoStepsToVisibleStop(17703000,'IL01'),0);
  assert.equal(demoStepsToVisibleStop(17703000,'IL02'),64373);
  assert.equal(demoStepsToVisibleStop(62763400,'IL02'),1);
  assert.equal(demoStepsToVisibleStop(62764100,'IL02'),0);
  assert.equal(demoStepsToVisibleStop(531084400,'IL12'),0);
});
