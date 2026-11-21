/** Serialize same-origin Manual writes, while preserving the existing v1 envelope. */
import { challengeDate } from './manual-engine.mjs';

export const MANUAL_STORAGE_KEY = 'horizon.route66.manual.v1';

function dateValid(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

function validate(state) {
  if (!object(state) || !dateValid(state.activatedOn) || !object(state.days) ||
      !object(state.awards) || typeof state.postcardSent !== 'boolean') {
    throw new TypeError('Invalid saved Manual progress');
  }
  challengeDate(0, state.zone);
  let total = 0;
  for (const [date, steps] of Object.entries(state.days)) {
    if (!dateValid(date) || date < state.activatedOn || !Number.isSafeInteger(steps) || steps < 0 || steps > 100_000) {
      throw new TypeError('Invalid saved Manual day');
    }
    total += steps * 700;
  }
  if (!Number.isSafeInteger(total) || total !== state.totalMm ||
      !['firstBadge','secondBadge','il01'].every(key => typeof state.awards[key] === 'boolean') ||
      (state.postcardSent && !state.awards.il01)) {
    throw new TypeError('Invalid saved Manual totals or awards');
  }
  return state;
}

export function createManualStore({ storage, locks }) {
  function read() {
    const raw = storage.getItem(MANUAL_STORAGE_KEY);
    if (raw === null) return null;
    const envelope = JSON.parse(raw);
    if (!object(envelope) || envelope.version !== 1) throw new TypeError('Unsupported saved Manual progress');
    return validate(envelope.state);
  }
  async function transact(mutator) {
    if (typeof mutator !== 'function') throw new TypeError('Expected a synchronous mutator');
    if (typeof locks?.request !== 'function') throw new Error('Safe Manual writes require Web Locks');
    return locks.request(MANUAL_STORAGE_KEY, { mode: 'exclusive' }, () => {
      const current = read();
      const next = mutator(current);
      if (next === current) return current;
      validate(next);
      storage.setItem(MANUAL_STORAGE_KEY, JSON.stringify({ version: 1, state: next }));
      return next;
    });
  }
  return { read, transact };
}
