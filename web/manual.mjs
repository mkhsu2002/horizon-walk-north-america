import { manualMilestones, manualJourneyNote, manualReturnPreview } from './journey-keepsake.mjs';
import { challengeDate, createManualState, setManualDay, saveManualPostcard } from './manual-engine.mjs';

import { createManualPostcards, MANUAL_SHELF_KEY } from './manual-postcards.mjs';
import { renderGallery } from './postcard-gallery.mjs';
import { MANUAL_STORAGE_KEY as NS, createManualStore } from './manual-store.mjs';
const el = id => document.getElementById(id);
const storage = {
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
const postcards = createManualPostcards(storage);
const store = createManualStore({ storage, locks: navigator.locks, postcards });
let ledger = null;
let formDirty = false;

function renderReturnWalk(validLedger) {
  const preview = manualReturnPreview(validLedger?.totalMm);
  const strip = el('return-walk');
  const demo = el('hero-demo');
  const manual = el('hero-manual');
  strip.hidden = !preview;
  const first = preview ? manual : demo;
  const row = first.parentElement;
  if (row.firstElementChild !== first) row.prepend(first);
  for (const [button, primary] of [[manual, Boolean(preview)], [demo, !preview]]) {
    button.classList.toggle('btn-primary', primary);
    button.classList.toggle('btn-secondary', !primary);
  }
  const title = el('return-walk-title');
  const story = el('return-walk-story');
  const distance = el('return-walk-distance');
  title.textContent = preview
    ? preview.completed ? 'Illinois chapter complete' : 'Next postcard: ' + preview.name
    : '';
  story.textContent = preview?.teaser ?? '';
  distance.textContent = preview?.steps ? stepLabel(preview.steps) + ' to go' : '';
  story.hidden = !story.textContent;
  distance.hidden = !distance.textContent;
}


function refresh() {
  try {
    const latest = store.read();
    // A clearing/removal event is not a valid replacement for already loaded progress.
    if (latest) ledger = latest;
    renderReturnWalk(latest);
    render();
    if (!formDirty) existingTotal();
    return latest;
  } catch {
    renderReturnWalk(null);
    announce('Saved Manual progress could not be read. Your entries were not replaced.');
    return undefined;
  }
}
function didCommit(next) {
  ledger = next;
  renderReturnWalk(next);
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
  if (manual) {
    render();
    if (ledger) store.updatePostcards().then(renderShelf).catch(shelfFailure);
  }
}
el('mode-demo').addEventListener('click', () => setMode(false));
el('mode-manual').addEventListener('click', () => setMode(true));

function openToday(discardDraft = false) {
  const latest = refresh();
  if (latest === undefined) return;
  if (!latest) {
    if (ledger) announce('Saved Manual progress is unavailable. Your entries were not replaced.');
    else el('manual-start').focus();
    return;
  }
  const date = el('manual-date');
  const today = challengeDate(Date.now(), latest.zone);
  const choice = el('manual-today-choice');
  if (formDirty && date.value !== today && !discardDraft) {
    el('manual-today-draft-note').textContent =
      'You have unsaved steps for ' + (date.value || 'the selected day') +
      '. Keep editing to save that entry, or discard the draft to log ' + today + '.';
    choice.hidden = false;
    el('manual-keep-draft').focus();
    return;
  }
  choice.hidden = true;
  if (!formDirty || discardDraft) {
    date.max = today;
    date.value = today;
    formDirty = false;
    existingTotal();
  }
  announce('');
  el('manual-steps').focus();
}
el('hero-manual').addEventListener('click', () => {
  el('mode-manual').click();
  openToday();
});
el('manual-keep-draft').addEventListener('click', () => {
  el('manual-today-choice').hidden = true;
  el('manual-steps').focus();
});
el('manual-discard-draft').addEventListener('click', () => openToday(true));
const stepLabel = n => n.toLocaleString('en-US') + (n === 1 ? ' step' : ' steps');

function render() {
  const targets = manualMilestones(ledger?.totalMm ?? 0);
  el('manual-first-target').textContent = ledger?.awards.firstBadge
    ? 'First Steps badge earned · 4.2 km.'
    : 'First Steps badge: ' + stepLabel(targets.firstBadgeSteps) + ' to go · 4.2 km total.';
  el('manual-next-target').textContent = targets.nextName
    ? targets.nextName + ': ' + stepLabel(targets.nextSteps) + ' to the next Illinois stop.'
    : 'Illinois chapter complete.';
  el('manual-card-note').textContent = manualJourneyNote(ledger);
  el('manual-card-note').hidden = !ledger?.awards.il01;
  el('manual-passport-entry').hidden = !ledger?.awards.firstBadge;
  const waitingForFirstCard = ledger?.awards.firstBadge && !ledger.awards.il01;
  el('manual-passport-heading').textContent = waitingForFirstCard
    ? 'Your first passport page is ready'
    : 'Your walking passport';
  const passportDistance = el('manual-passport-distance');
  passportDistance.hidden = !waitingForFirstCard;
  passportDistance.textContent = waitingForFirstCard
    ? 'North Lawndale’s postcard unlocks at 17.703 km. ' + stepLabel(targets.nextSteps ?? 0) + ' to go.'
    : '';
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
  renderShelf();
}
function shelfFailure() {
  el('manual-shelf-status').textContent = 'The postcard collection could not be updated safely.';
}
function renderShelf() {
  if (!ledger) return;
  let shelf;
  try { shelf = postcards.read(); } catch { shelfFailure(); return; }
  renderGallery(el('manual-shelf'), el('manual-shelf-status'), shelf, async id => {
    await store.updatePostcards(id);
    renderShelf();
    window.dispatchEvent(new Event('route66:manual-shelf'));
  });
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
el('manual-date').addEventListener('change', () => {
  el('manual-today-choice').hidden = true;
  formDirty = false;
  existingTotal();
});
el('manual-form').addEventListener('submit', async event => {
  event.preventDefault();
  const value = el('manual-steps').value.trim();
  if (!/^\d+$/.test(value)) { announce('Enter a whole number from 0 to 100,000.'); return; }
  const date = el('manual-date').value;
  const fieldValue = el('manual-steps').value;
  const focusedAtSubmit = document.activeElement;
  const form = el('manual-form');
  let earned = 0, firstPageToday = false, inputError = null;
  try {
    const next = await store.transact(current => {
      if (!current) throw new Error('Manual challenge is not available');
      let candidate;
      const now = Date.now();
      try { candidate = setManualDay(current, date, Number(value), now); }
      catch (error) { inputError = error; throw error; }
      earned = Object.keys(candidate.awards).filter(key => candidate.awards[key] && !current.awards[key]).length;
      firstPageToday = !current.awards.firstBadge && candidate.awards.firstBadge && !candidate.awards.il01
        && date === challengeDate(now, current.zone);
      return candidate;
    });
    didCommit(next);
    const stillEditingThisSave = el('manual-date').value === date && el('manual-steps').value === fieldValue;
    if (stillEditingThisSave) {
      formDirty = false;
      el('manual-today-choice').hidden = true;
    }
    const showFirstPageNow = firstPageToday && stillEditingThisSave && !el('manual-panel').hidden;
    announce('Daily total saved for ' + date + '.' + (showFirstPageNow
      ? ' Your first passport page is ready. Your first postcard is still ahead.'
      : earned ? ' New rewards in your collection: ' + earned + '.' : ''));
    if (showFirstPageNow && document.activeElement === focusedAtSubmit && form.contains(focusedAtSubmit)) {
      // Reveal the heading, postcard distance and action together. Focusing the
      // heading alone can leave the button below a small mobile viewport.
      el('manual-passport-entry').scrollIntoView({ block: 'center', behavior: 'instant' });
      el('manual-passport-heading').focus({ preventScroll: true });
    }
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
  if (event.key !== NS && event.key !== MANUAL_SHELF_KEY && event.key !== null) return;
  try { if (event.storageArea !== window.localStorage) return; }
  catch { return; }
  refresh();
});
refresh();
