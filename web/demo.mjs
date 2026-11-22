import { routeProgress, demoStepsToVisibleStop } from './route-catalog.mjs';
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
import { renderGallery } from './postcard-gallery.mjs';

import { createDemoStore, DEMO_STORAGE_KEY, INITIAL_GENERATION, DemoResetConflict } from './demo-store.mjs';

const store = createDemoStore({
  storage: {getItem:key=>localStorage.getItem(key), setItem:(key,value)=>localStorage.setItem(key,value)},
  locks: navigator.locks, newGeneration: () => crypto.randomUUID(),
});
let generation = INITIAL_GENERATION;

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
let walkingToStop = false;


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

  const next = routeProgress(state.totalMm).next;
  btnTopup.hidden = !next;
  btnTopup.disabled = walkingToStop || !next;
  btnTopup.dataset.stopId = next?.id ?? '';
  btnTopup.textContent = next ? 'Walk to ' + next.name : 'Illinois chapter complete';

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
    } else {
      el.classList.remove('badge--unlocked', 'badge--new-unlock');
      el.classList.add('badge--locked');
      statusEl.textContent = 'locked';
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
    btnSavePostcard.textContent = postcardSaved ? 'Postcard saved ✓' : 'Save postcard';
  } else {
    postcard.classList.add('postcard--hidden');
    postcard.setAttribute('aria-hidden','true');
    postcardHint.textContent = 'Reach IL01 to unlock your postcard.';
    btnSavePostcard.disabled = true;
    btnSavePostcard.textContent = 'Save postcard';
  }

  // Announce new awards
  if (newAwards.length > 0) {
    const labels = newAwards.map(mm => BADGE_META[mm]?.shortLabel ?? String(mm)).join(', ');
    announce(`Badge unlocked: ${labels}`);
  }
}

// Keep the flat v1 ledger contract; only the generation field is new.
function show(next, awards = []) {
  generation=next.generation;
  appState=next.state;
  postcardSaved=next.postcardSaved;
  render(appState, awards);
  const shelfStatus=document.getElementById('demo-shelf-status');
  const viewedGeneration=next.generation;
  renderGallery(document.getElementById('demo-shelf'),shelfStatus,next.shelf,
    async id=>show(await store.save(viewedGeneration,id)));
  window.dispatchEvent(new Event('route66:demo-ledger'));
}
function readLatest() {
  try { show(store.read()); } catch { announce('Saved Demo progress could not be read.'); }
}
async function dispatch(steps, stopId = null) {
  const batchId=crypto.randomUUID();
  let awards=[];
  try {
    const next=await store.transact(generation, current=>{
      const count=stopId ? demoStepsToVisibleStop(current.state.totalMm, stopId) : steps;
      if (!count) return current;
      const result=applyBatch(current.state,{id:batchId,steps:count});
      awards=result.newAwards;
      return result.state===current.state ? current : {...current,state:result.state};
    });
    show(next,awards);
  } catch(error) { failed(error); }
}
function failed(error) {
  if(error instanceof DemoResetConflict) {
    readLatest();
    announce('Demo was reset in another tab. This action was not applied.');
  } else announce('Demo progress could not be saved safely.');
}
document.getElementById('btn-6k').addEventListener('click',()=>dispatch(6_000));
document.getElementById('btn-12k').addEventListener('click',()=>dispatch(12_000));
btnTopup.addEventListener('click', async event => {
  // Native pointer double-clicks stay one action even if storage commits between clicks.
  if (event.detail > 1) return;
  const stopId = btnTopup.dataset.stopId;
  if (walkingToStop || !stopId) return;
  walkingToStop = true;
  btnTopup.disabled = true;
  try { await dispatch(0, stopId); }
  finally {
    walkingToStop = false;
    btnTopup.disabled = btnTopup.hidden;
  }
});
btnSavePostcard.addEventListener('click',async()=>{
  try {
    const next=await store.transact(generation,current=>{
      if(current.postcardSaved || !current.state.awarded.has(IL01_MM)) return current;
      return {...current,postcardSaved:true};
    });
    show(next);
    if(next.postcardSaved) announce('Postcard saved in this browser.');
  } catch(error) { failed(error); }
});
document.getElementById('btn-reset').addEventListener('click',async()=>{
  const observed=generation;
  if(!window.confirm('Reset all Demo progress? This cannot be undone.')) return;
  try { show(await store.reset(observed)); announce('Progress reset.'); }
  catch(error) { failed(error); }
});
addEventListener('storage',event=>{
  if(event.key!==DEMO_STORAGE_KEY && event.key!==null) return;
  try { if(event.storageArea!==localStorage) return; } catch {return;}
  readLatest();
});
readLatest();

store.initialize().then(readLatest).catch(() => announce('Demo progress could not be initialized safely.'));
