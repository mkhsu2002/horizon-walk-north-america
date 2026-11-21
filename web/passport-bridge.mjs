import { readDemoAuthority, DEMO_STORAGE_KEY } from './demo-store.mjs';
import { initPassport } from './passport.mjs';
const root = document.getElementById('passport');
const setPassport = initPassport(root);
let mode = 'Demo';
const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
function refresh(nextMode = mode) {
  mode = nextMode;

  if (mode === 'Demo') {
    let demo;
    try { demo = readDemoAuthority(localStorage); } catch {}
    const awards = demo?.state.awarded ?? new Set();
    setPassport(mode,{totalMm: demo?.state.totalMm ?? 0,firstBadge:awards.has(4200000),secondBadge:awards.has(12600000),il01:awards.has(17703000),postcardSaved:demo?.postcardSaved === true});
  } else {
    const s = read('horizon.route66.manual.v1')?.state;
    setPassport(mode,{totalMm:s?.totalMm ?? 0,firstBadge:s?.awards?.firstBadge === true,secondBadge:s?.awards?.secondBadge === true,il01:s?.awards?.il01 === true,postcardSaved:s?.postcardSent === true});
  }
}
document.getElementById('mode-demo').addEventListener('click',() => refresh('Demo'));
document.getElementById('mode-manual').addEventListener('click',() => refresh('Manual'));
document.getElementById('demo-panel').addEventListener('click',() => queueMicrotask(() => refresh()));
document.getElementById('manual-panel').addEventListener('click',() => queueMicrotask(() => refresh()));
document.getElementById('manual-form').addEventListener('submit',() => queueMicrotask(() => refresh()));
addEventListener('route66:manual-ledger', () => { if (mode === 'Manual') refresh(); });
addEventListener('storage',event => {
  if (event.key === null || event.key === (mode === 'Demo' ? DEMO_STORAGE_KEY : 'horizon.route66.manual.v1')) refresh();
});
refresh();

addEventListener('route66:demo-ledger', () => { if (mode === 'Demo') refresh(); });
