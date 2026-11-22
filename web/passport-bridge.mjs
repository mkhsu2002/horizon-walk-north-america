import { createManualPostcards, MANUAL_SHELF_KEY } from './manual-postcards.mjs';
import { readDemoAuthority, DEMO_STORAGE_KEY } from './demo-store.mjs';
import { createManualStore, MANUAL_STORAGE_KEY } from './manual-store.mjs';
import { manualJourneyNote, demoJourneyNote } from './journey-keepsake.mjs';
import { initPassport } from './passport.mjs';
const root = document.getElementById('passport');
const setPassport = initPassport(root);
let mode = 'Demo';
const readManual = () => {
  try { return createManualStore({ storage: localStorage }).read(); } catch { return null; }
};
for (const control of document.querySelectorAll('[data-open-my-passport]')) {
  control.addEventListener('click', () => root.querySelector('[data-passport-open]').click());
}
function refresh(nextMode = mode) {
  mode = nextMode;

  if (mode === 'Demo') {
    let demo;
    try { demo = readDemoAuthority(localStorage); } catch {}
    const awards = demo?.state.awarded ?? new Set();
    setPassport(mode,{totalMm: demo?.state.totalMm ?? 0,firstBadge:awards.has(4200000),secondBadge:awards.has(12600000),il01:awards.has(17703000),postcardSaved:demo?.postcardSaved === true,saved:demo?.shelf.saved,journeyNote:demoJourneyNote(demo?.state)});
  } else {
    const s = readManual();
    let saved;
    try { if(s) saved=createManualPostcards(localStorage).read().saved; } catch {}
    setPassport(mode,{saved,totalMm:s?.totalMm ?? 0,firstBadge:s?.awards?.firstBadge === true,secondBadge:s?.awards?.secondBadge === true,il01:s?.awards?.il01 === true,postcardSaved:s?.postcardSent === true,journeyNote:manualJourneyNote(s)});
  }
}
document.getElementById('mode-demo').addEventListener('click',() => refresh('Demo'));
document.getElementById('mode-manual').addEventListener('click',() => refresh('Manual'));
document.getElementById('demo-panel').addEventListener('click',() => queueMicrotask(() => refresh()));
document.getElementById('manual-panel').addEventListener('click',() => queueMicrotask(() => refresh()));
document.getElementById('manual-form').addEventListener('submit',() => queueMicrotask(() => refresh()));
addEventListener('route66:manual-ledger', () => { if (mode === 'Manual') refresh(); });
addEventListener('storage',event => {
  if (event.key === null || event.key === (mode === 'Demo' ? DEMO_STORAGE_KEY : MANUAL_STORAGE_KEY) || (mode === 'Manual' && event.key === MANUAL_SHELF_KEY)) refresh();
});
refresh();

addEventListener('route66:demo-ledger', () => { if (mode === 'Demo') refresh(); });

addEventListener('route66:manual-shelf', () => { if (mode === 'Manual') refresh(); });
