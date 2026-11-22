import { addDeparture, DEPARTURE_ID } from './journey-keepsake.mjs';
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
import { postcardFigure, renderGallery } from './postcard-gallery.mjs';
import { POSTCARD_MEDIA } from './postcard-media.mjs';

const demoMedia = {
  ...POSTCARD_MEDIA,
  IL01: {
    src: 'il01-illustration.png', width: 1536, height: 1024,
    alt: 'Interpretive illustration of North Lawndale and its elevated train on Route 66',
    caption: 'North Lawndale · Illustration',
    credit: 'Original Route 66 project illustration, made with OpenAI ImageGen.',
    storySource: 'https://www.transitchicago.com/cta-and-north-lawndale-organizations-celebrate-the-100th-anniversary-of-route-66/',
  },
};

import { createDemoStore, DEMO_STORAGE_KEY, INITIAL_GENERATION, DemoResetConflict } from './demo-store.mjs';

const store = createDemoStore({
  storage: {getItem:key=>localStorage.getItem(key), setItem:(key,value)=>localStorage.setItem(key,value)},
  locks: navigator.locks, newGeneration: () => crypto.randomUUID(),
});
let generation = INITIAL_GENERATION;

// ── Constants ─────────────────────────────────────────────────────────────────

const MM_PER_KM      = 1_000_000;
const STEPS_PER_STEP = 700; // mm per step

const BADGE_META = {
  4_200_000:  { id: 'badge-4200',  label: 'First Steps (4.2 km)',           shortLabel: 'First Steps'    },
  12_600_000: { id: 'badge-12600', label: 'Route Wanderer (12.6 km)',        shortLabel: 'Route Wanderer' },
  17_703_000: { id: 'badge-il01',  label: 'IL01 — North Lawndale (17.703 km)', shortLabel: 'IL01'        },
};

// ── State ─────────────────────────────────────────────────────────────────────

let appState      = createState();
let walkingToStop = false;


// ── DOM refs ──────────────────────────────────────────────────────────────────

const displaySteps    = document.getElementById('display-steps');
const displayMm       = document.getElementById('display-mm');
const displayKm       = document.getElementById('display-km');
const heroDemo = document.getElementById('hero-demo');
const departure = document.getElementById('demo-departure');
const btnTopup        = document.getElementById('btn-topup');
const demoPanel = document.getElementById('demo-panel');
const arrival = document.getElementById('demo-arrival');
const arrivalHeading = document.getElementById('demo-arrival-heading');
const arrivalStatus = document.getElementById('demo-arrival-status');
const passportShortcut = document.getElementById('demo-passport-shortcut');
let renderedArrival = '';
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
  btnTopup.textContent = next ? 'Simulate walk to ' + next.name : 'Illinois chapter complete';

  if (!state.seenIds.has(DEPARTURE_ID)) {
    departure.hidden = true;
    departure.open = true;
  } else if (departure.hidden) {
    departure.hidden = false;
    departure.open = routeProgress(state.totalMm).current.id === 'IL00';
  }
  heroDemo.textContent = state.totalMm === 0 ? 'Try 500 simulated steps' : 'Continue my Demo Walk';
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

  // Announce new awards
  if (newAwards.length > 0) {
    const labels = newAwards.map(mm => BADGE_META[mm]?.shortLabel ?? String(mm)).join(', ');
    announce(`Badge unlocked: ${labels}`);
  }
}

function renderArrival(next) {
  const stop = routeProgress(next.state.totalMm).current;
  const art = next.shelf.earned.includes(stop.id) ? demoMedia[stop.id] : null;
  const count = next.shelf.saved.length;
  passportShortcut.textContent = 'View / print my passport (' + count + (count === 1 ? ' card)' : ' cards)');
  passportShortcut.disabled = !next.state.awarded.has(4_200_000);
  document.getElementById('demo-collection-prompt').hidden = Boolean(art);
  document.getElementById('demo-current-card-link').hidden = !art;
  arrival.hidden = !art;
  if (!art) { renderedArrival = ''; return null; }
  const saved = next.shelf.saved.includes(stop.id);
  const key = JSON.stringify([next.generation, stop.id, saved]);
  if (key === renderedArrival) return stop.id;
  if (renderedArrival === '') departure.open = false;
  renderedArrival = key;
  arrivalHeading.textContent = 'Arrived at ' + stop.name;
  arrivalStatus.textContent = saved ? 'Saved to your Demo passport.' : 'Postcard unlocked · Not saved yet.';
  document.getElementById('demo-arrival-art').replaceChildren(postcardFigure(art));
  const slot = document.getElementById('demo-arrival-save');
  slot.replaceChildren();
  if (!saved) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-primary';
    button.textContent = 'Save ' + stop.name + ' postcard';
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      button.disabled = true;
      try {
        const result = await store.save(next.generation, stop.id);
        const keepFocus = document.activeElement === button || document.activeElement === document.body;
        const displayedId = show(result);
        if (displayedId === stop.id && !demoPanel.hidden && keepFocus) passportShortcut.focus();
      } catch (error) {
        if (button.isConnected) button.disabled = false;
        failed(error);
      }
    });
    slot.append(button);
  }
  return stop.id;
}

function show(next, awards = []) {
  generation=next.generation;
  appState=next.state;
  render(appState, awards);
  const arrivalId = renderArrival(next);
  const shelfStatus=document.getElementById('demo-shelf-status');
  renderGallery(document.getElementById('demo-shelf'),shelfStatus,next.shelf,
    async id=>show(await store.save(next.generation,id)), { media: demoMedia, excludeId: arrivalId });
  window.dispatchEvent(new Event('route66:demo-ledger'));
  return arrivalId;
}
function readLatest() {
  try { show(store.read()); } catch { announce('Saved Demo progress could not be read.'); }
}
async function dispatch(steps, stopId = null) {
  const batchId=crypto.randomUUID();
  let awards=[], advanced=false;
  try {
    const next=await store.transact(generation, current=>{
      const count=stopId ? demoStepsToVisibleStop(current.state.totalMm, stopId) : steps;
      if (!count) return current;
      const result=applyBatch(current.state,{id:batchId,steps:count});
      awards=result.newAwards;
      advanced = result.state !== current.state;
      return result.state===current.state ? current : {...current,state:result.state};
    });
    const arrivalId = show(next,awards);
    if (advanced && stopId && arrivalId === stopId && !demoPanel.hidden) {
      const focused = document.activeElement;
      if (focused === btnTopup || focused === document.body) {
        arrival.scrollIntoView({ block: 'start' });
        arrivalHeading.focus({ preventScroll: true });
      }
    }
  } catch(error) { failed(error); }
}
function failed(error) {
  if(error instanceof DemoResetConflict) {
    readLatest();
    announce('Demo was reset in another tab. This action was not applied.');
  } else announce('Demo progress could not be saved safely.');
}
function focusNextStop() {
  (btnTopup.hidden ? document.getElementById('demo-next-heading') : btnTopup).focus();
}
let departurePending = false;
heroDemo.addEventListener('click', async () => {
  if (departurePending) return;
  departurePending = true;
  document.getElementById('mode-demo').click();
  try {
    if (appState.totalMm === 0) {
      show(await store.transact(generation, addDeparture));
      if (!departure.hidden) {
        document.getElementById('departure-heading').focus();
        announce('Departure keepsake unlocked. 500 simulated steps. Your first stop is still ahead.');
        return;
      }
    }
    focusNextStop();
  } catch (error) { failed(error); focusNextStop(); }
  finally { departurePending = false; }
});
document.getElementById('departure-onward').addEventListener('click', focusNextStop);
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
