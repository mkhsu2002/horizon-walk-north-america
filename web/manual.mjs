import { challengeDate, createManualState, setManualDay, saveManualPostcard } from './manual-engine.mjs';

import { MANUAL_STORAGE_KEY as NS, createManualStore } from './manual-store.mjs';
const el = id => document.getElementById(id);
const storage = {
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
const store = createManualStore({ storage, locks: navigator.locks });
let ledger = null;
let formDirty = false;

function refresh() {
  try {
    const latest = store.read();
    // A clearing/removal event is not a valid replacement for already loaded progress.
    if (latest) ledger = latest;
    render();
    if (!formDirty) existingTotal();
  } catch {
    announce('Saved Manual progress could not be read. Your entries were not replaced.');
  }
}
function didCommit(next) {
  ledger = next;
  render();
  window.dispatchEvent(new Event('route66:manual-ledger'));
}
const writeUnavailable = 'Manual progress could not be saved safely. Your existing progress was not replaced.';
function setMode(manual) {
  el('demo-panel').hidden = manual;
  el('manual-panel').hidden = !manual;
  document.querySelector('.demo-banner').hidden = manual;
  el('mode-demo').setAttribute('aria-pressed', String(!manual));
  el('mode-manual').setAttribute('aria-pressed', String(manual));
  if (manual) render();
}
el('mode-demo').addEventListener('click', () => setMode(false));
el('mode-manual').addEventListener('click', () => setMode(true));

function render() {
  el('manual-start').hidden = Boolean(ledger);
  el('manual-form').hidden = !ledger;
  if (!ledger) return;
  const date = el('manual-date');
  const today = challengeDate(Date.now(), ledger.zone);
  date.min = ledger.activatedOn;
  date.max = today;
  if (!date.value) date.value = today;
  el('manual-zone').textContent = 'Challenge time zone: ' + ledger.zone;
  el('manual-total').textContent = (ledger.totalMm / 700).toLocaleString('en-US');
  el('manual-distance').textContent = (ledger.totalMm / 1e6).toFixed(3) + ' km';
  el('manual-badge-one').textContent = ledger.awards.firstBadge ? 'Earned' : 'Locked';
  el('manual-badge-two').textContent = ledger.awards.secondBadge ? 'Earned' : 'Locked';
  el('manual-badge-stop').textContent = ledger.awards.il01 ? 'Unlocked' : 'Locked';
  el('manual-image').hidden = !ledger.awards.il01;
  el('manual-postcard').disabled = !ledger.awards.il01 || ledger.postcardSent;
  el('manual-postcard').textContent = ledger.postcardSent ? 'Manual postcard saved' : 'Save Manual postcard';
}
function announce(message) { el('manual-status').textContent = message; }
function existingTotal() { el('manual-steps').value = ledger?.days[el('manual-date').value] ?? ''; }
el('manual-start').addEventListener('click', async () => {
  try {
    const next = await store.transact(current => current
      ?? createManualState(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'));
    didCommit(next);
    el('manual-steps').focus();
    announce('Manual Walk started. Your challenge time zone is fixed.');
  } catch { announce(writeUnavailable); }
});
el('manual-steps').addEventListener('input', () => { formDirty = true; });
el('manual-date').addEventListener('change', () => { formDirty = false; existingTotal(); });
el('manual-form').addEventListener('submit', async event => {
  event.preventDefault();
  const value = el('manual-steps').value.trim();
  if (!/^\d+$/.test(value)) { announce('Enter a whole number from 0 to 100,000.'); return; }
  const date = el('manual-date').value;
  const fieldValue = el('manual-steps').value;
  let earned = 0, inputError = null;
  try {
    const next = await store.transact(current => {
      if (!current) throw new Error('Manual challenge is not available');
      let candidate;
      try { candidate = setManualDay(current, date, Number(value), Date.now()); }
      catch (error) { inputError = error; throw error; }
      earned = Object.keys(candidate.awards).filter(key => candidate.awards[key] && !current.awards[key]).length;
      return candidate;
    });
    didCommit(next);
    if (el('manual-date').value === date && el('manual-steps').value === fieldValue) formDirty = false;
    announce('Daily total saved.' + (earned ? ' New rewards in your collection: ' + earned + '.' : ''));
  } catch { announce(inputError?.message ?? writeUnavailable); }
});
el('manual-postcard').addEventListener('click', async () => {
  try {
    const next = await store.transact(current => {
      if (!current) throw new Error('Manual challenge is not available');
      return saveManualPostcard(current);
    });
    didCommit(next);
    announce('Postcard saved in your Manual collection.');
  } catch { announce(writeUnavailable); }
});
addEventListener('storage', event => {
  if (event.key !== NS && event.key !== null) return;
  try { if (event.storageArea !== window.localStorage) return; }
  catch { return; }
  refresh();
});
refresh();
