import { routeProgress } from './route-catalog.mjs';
import { applyBatch } from './step-engine.mjs';

export const DEPARTURE_ID = 'horizon.route66.departure.v1';
export const DEPARTURE_STEPS = 500;

// Call inside the existing Demo authority lock. The stable batch identifier
// is already persisted with the ledger and is cleared by its normal reset.
export function addDeparture(current) {
  if (current.state.totalMm > 0) return current;
  const { state } = applyBatch(current.state, { id: DEPARTURE_ID, steps: DEPARTURE_STEPS });
  return state === current.state ? current : { ...current, state };
}

export function manualMilestones(totalMm) {
  const { next, remainingToNextMm } = routeProgress(totalMm);
  return {
    firstBadgeSteps: Math.max(0, Math.ceil((4_200_000 - totalMm) / 700)),
    nextName: next?.name ?? null,
    nextSteps: next ? Math.ceil(remainingToNextMm / 700) : null,
  };
}

// A snapshot of the valid ledger now, not a historical claim about when a stamp
// was earned. Zero-step Manual entries do not count as walking days.
export function manualJourneyNote(ledger) {
  if (!ledger) return '';
  const count = Object.values(ledger.days).filter(n => n > 0).length;
  return `Current log: ${count.toLocaleString('en-US')} ${count === 1 ? 'day' : 'days'} with steps entered.`;
}

export function demoJourneyNote(state) {
  if (!state || !state.seenIds.size) return '';
  const count = state.seenIds.size;
  return `Current demo: ${count.toLocaleString('en-US')} recorded simulated ${count === 1 ? 'leg' : 'legs'}.`;
}
