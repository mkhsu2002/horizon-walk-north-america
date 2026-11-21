import { challengeDate, createManualState, setManualDay, saveManualPostcard } from './manual-engine.mjs';

const NS = 'horizon.route66.manual.v1';
const el = id => document.getElementById(id);
let ledger = null;
try {
  const stored = JSON.parse(localStorage.getItem(NS));
  if (stored?.version === 1 && stored.state?.activatedOn && stored.state?.zone) ledger = stored.state;
} catch { /* no saved challenge */ }

function store(next) {
  localStorage.setItem(NS, JSON.stringify({ version: 1, state: next }));
  ledger = next;
}
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
el('manual-start').addEventListener('click', () => {
  try {
    store(createManualState(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'));
    render();
    el('manual-steps').focus();
    announce('Manual Walk started. Your challenge time zone is fixed.');
  } catch { announce('This browser could not save your new challenge.'); }
});
el('manual-date').addEventListener('change', existingTotal);
el('manual-form').addEventListener('submit', event => {
  event.preventDefault();
  const value = el('manual-steps').value.trim();
  if (!/^\d+$/.test(value)) { announce('Enter a whole number from 0 to 100,000.'); return; }
  const date = el('manual-date').value;
  let next;
  try { next = setManualDay(ledger, date, Number(value), Date.now()); }
  catch (error) { announce(error.message); return; }
  const earned = Object.keys(next.awards).filter(key => next.awards[key] && !ledger.awards[key]).length;
  try { store(next); }
  catch { announce('This browser could not save your step total.'); return; }
  render();
  announce('Daily total saved.' + (earned ? ' New rewards in your collection: ' + earned + '.' : ''));
});
el('manual-postcard').addEventListener('click', () => {
  try { store(saveManualPostcard(ledger)); }
  catch { announce('This browser could not save your postcard.'); return; }
  render();
  announce('Postcard saved in your Manual collection.');
});
render();
