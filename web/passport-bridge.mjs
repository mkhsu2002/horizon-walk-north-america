import { initPassport } from './passport.mjs';
const root = document.getElementById('passport');
const setPassport = initPassport(root);
let mode = 'Demo';
const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
function refresh(nextMode = mode) {
  mode = nextMode;
  const saved = read('horizon.route66.' + mode.toLowerCase() + '.v1');
  if (mode === 'Demo') {
    const awards = new Set(saved?.awarded ?? []);
    setPassport(mode,{totalMm: saved?.totalMm ?? 0,firstBadge:awards.has(4200000),secondBadge:awards.has(12600000),il01:awards.has(17703000),postcardSaved:saved?.postcardSaved === true});
  } else {
    const s = saved?.state;
    setPassport(mode,{totalMm:s?.totalMm ?? 0,firstBadge:s?.awards?.firstBadge === true,secondBadge:s?.awards?.secondBadge === true,il01:s?.awards?.il01 === true,postcardSaved:s?.postcardSent === true});
  }
}
document.getElementById('mode-demo').addEventListener('click',() => refresh('Demo'));
document.getElementById('mode-manual').addEventListener('click',() => refresh('Manual'));
document.getElementById('demo-panel').addEventListener('click',() => queueMicrotask(() => refresh()));
document.getElementById('manual-panel').addEventListener('click',() => queueMicrotask(() => refresh()));
document.getElementById('manual-form').addEventListener('submit',() => queueMicrotask(() => refresh()));
addEventListener('storage',() => refresh());
refresh();
