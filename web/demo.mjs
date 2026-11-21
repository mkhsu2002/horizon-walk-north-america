/**
 * Horizon Walk the World — Route 66 · English Demo
 * Standalone browser prototype (simulated, no account).
 *
 * Engine contract:
 *   createState()  → { totalMm:0, seenIds:Set, awarded:Set }
 *   applyBatch(state, { id, steps }) → { state, newAwards:[] }
 *
 * Milestones are in millimetres. 1 step = 0.7 m = 700 mm.
 * Namespace: horizon.route66.demo.v1
 */

import { createState, applyBatch } from './step-engine.mjs';

// ── Storage helpers ───────────────────────────────────────────────────────────

const NS = 'horizon.route66.demo.v1';

function saveToStorage(state, postcardSaved) {
  try {
    const payload = {
      totalMm:      state.totalMm,
      seenIds:      [...state.seenIds],
      awarded:      [...state.awarded],
      postcardSaved,
    };
    localStorage.setItem(NS, JSON.stringify(payload));
  } catch (_) { /* storage unavailable — silent */ }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(NS);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    return {
      state: {
        totalMm: Number.isSafeInteger(payload.totalMm) && payload.totalMm >= 0 && payload.totalMm % 700 === 0 ? payload.totalMm : 0,
        seenIds: new Set(Array.isArray(payload.seenIds) ? payload.seenIds : []),
        awarded: new Set(Array.isArray(payload.awarded)  ? payload.awarded  : []),
      },
      postcardSaved: Boolean(payload.postcardSaved),
    };
  } catch (_) { return null; }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MM_PER_KM      = 1_000_000;
const STEPS_PER_STEP = 700; // mm per step

const IL01_STEPS   = 25_290;           // cumulative target for top-up
const IL01_MM      = IL01_STEPS * STEPS_PER_STEP; // 17_703_000

const BADGE_META = {
  4_200_000:  { id: 'badge-4200',  label: 'First Steps (4.2 km)',           shortLabel: 'First Steps'    },
  12_600_000: { id: 'badge-12600', label: 'Route Wanderer (12.6 km)',        shortLabel: 'Route Wanderer' },
  17_703_000: { id: 'badge-il01',  label: 'IL01 — North Lawndale (17.703 km)', shortLabel: 'IL01'        },
};

// ── State ─────────────────────────────────────────────────────────────────────

let appState      = createState();
let postcardSaved = false;


// ── DOM refs ──────────────────────────────────────────────────────────────────

const displaySteps    = document.getElementById('display-steps');
const displayMm       = document.getElementById('display-mm');
const displayKm       = document.getElementById('display-km');
const btnTopup        = document.getElementById('btn-topup');
const btnSavePostcard = document.getElementById('btn-save-postcard');
const postcard        = document.getElementById('postcard');
const postcardHint    = document.getElementById('postcard-hint');
const announcer       = document.getElementById('live-announcer');

// ── Live announcer ────────────────────────────────────────────────────────────

function announce(msg) {
  // Double-toggle forces re-announcement if same text fires twice.
  announcer.textContent = '';
  requestAnimationFrame(() => { announcer.textContent = msg; });
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function totalSteps(state) {
  return Math.round(state.totalMm / STEPS_PER_STEP);
}

function render(state, newAwards = []) {
  const steps = totalSteps(state);
  const km    = state.totalMm / MM_PER_KM;

  displaySteps.textContent = steps.toLocaleString('en-US');
  displayMm.textContent    = state.totalMm.toLocaleString('en-US') + ' mm';
  displayKm.textContent    = km.toFixed(3) + ' km';

  // Top-up button: no-op once at or past IL01
  if (steps >= IL01_STEPS) {
    btnTopup.disabled            = true;
    btnTopup.textContent         = 'IL01 reached ✓';
    btnTopup.setAttribute('aria-disabled', 'true');
  }

  // Badges
  for (const [mmStr, meta] of Object.entries(BADGE_META)) {
    const mm  = Number(mmStr);
    const el  = document.getElementById(meta.id);
    const statusEl = el.querySelector('.badge-status');
    const wasUnlocked = el.classList.contains('badge--unlocked');
    const isUnlocked  = state.awarded.has(mm);

    if (isUnlocked && !wasUnlocked) {
      el.classList.remove('badge--locked');
      el.classList.add('badge--unlocked', 'badge--new-unlock');
      statusEl.textContent = 'unlocked';
      el.addEventListener('animationend', () => {
        el.classList.remove('badge--new-unlock');
      }, { once: true });
    } else if (isUnlocked) {
      el.classList.remove('badge--locked');
      el.classList.add('badge--unlocked');
      statusEl.textContent = 'unlocked';
    }
  }

  // Postcard
  const il01Unlocked = state.awarded.has(17_703_000);
  if (il01Unlocked) {
    postcard.classList.remove('postcard--hidden');
    postcard.removeAttribute('aria-hidden');
    postcardHint.textContent = postcardSaved
      ? 'Postcard saved locally.'
      : 'Your postcard is ready!';
    btnSavePostcard.disabled = postcardSaved;
    if (postcardSaved) {
      btnSavePostcard.textContent = 'Postcard saved ✓';
    }
  }

  // Announce new awards
  if (newAwards.length > 0) {
    const labels = newAwards.map(mm => BADGE_META[mm]?.shortLabel ?? String(mm)).join(', ');
    announce(`Badge unlocked: ${labels}`);
  }
}

// ── Batch dispatch ────────────────────────────────────────────────────────────

function dispatch(steps) {
  if (steps <= 0) return;
  const batchId = crypto.randomUUID();
  const { state: nextState, newAwards } = applyBatch(appState, { id: batchId, steps });
  appState = nextState;
  saveToStorage(appState, postcardSaved);
  render(appState, newAwards);
}

// ── Postcard save ─────────────────────────────────────────────────────────────

function savePostcard() {
  if (postcardSaved) return;
  postcardSaved = true;
  saveToStorage(appState, postcardSaved);

  render(appState, []);
  announce('Postcard saved in this browser.');
}

// ── Wiring ────────────────────────────────────────────────────────────────────

document.getElementById('btn-6k').addEventListener('click', () => {
  dispatch(6_000);
});

document.getElementById('btn-12k').addEventListener('click', () => {
  dispatch(12_000);
});

btnTopup.addEventListener('click', () => {
  const current = totalSteps(appState);
  if (current >= IL01_STEPS) return; // no-op guard
  const needed = IL01_STEPS - current;
  dispatch(needed);
});

btnSavePostcard.addEventListener('click', () => {
  savePostcard();
});

document.getElementById('btn-reset').addEventListener('click', () => {
  if (!window.confirm('Reset all progress? This cannot be undone.')) return;
  try { localStorage.removeItem(NS); } catch (_) {}
  appState      = createState();
  postcardSaved = false;

  // Re-lock badges in DOM
  for (const meta of Object.values(BADGE_META)) {
    const el = document.getElementById(meta.id);
    el.classList.remove('badge--unlocked', 'badge--new-unlock');
    el.classList.add('badge--locked');
    el.querySelector('.badge-status').textContent = 'locked';
  }

  // Re-hide postcard
  postcard.classList.add('postcard--hidden');
  postcard.setAttribute('aria-hidden', 'true');
  postcardHint.textContent = 'Reach IL01 to unlock your postcard.';
  btnSavePostcard.disabled     = true;
  btnSavePostcard.textContent  = 'Save postcard';
  btnTopup.disabled            = false;
  btnTopup.textContent         = 'Top-up to IL01 (25,290 steps)';
  btnTopup.removeAttribute('aria-disabled');

  render(appState, []);
  announce('Progress reset.');
});

// ── Boot: restore from localStorage ──────────────────────────────────────────

(function boot() {
  const saved = loadFromStorage();
  if (saved) {
    appState      = saved.state;
    postcardSaved = saved.postcardSaved;
  }
  render(appState, []);
})();
