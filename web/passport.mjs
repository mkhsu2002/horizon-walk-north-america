export function initPassport(root) {
  const open    = root.querySelector('[data-passport-open]');
  const sheet   = root.querySelector('[data-passport-sheet]');
  const modeEl  = root.querySelector('[data-passport-mode]');
  const distEl  = root.querySelector('[data-passport-distance]');
  const awardsEl= root.querySelector('[data-passport-awards]');
  const card    = root.querySelector('[data-passport-card]');
  const print   = root.querySelector('[data-passport-print]');
  const close   = root.querySelector('[data-passport-close]');

  let currentMode = null;
  function formatDistance(totalMm) {
    const km = Number.isSafeInteger(totalMm) && totalMm >= 0 ? totalMm / 1e6 : 0;
    return `Distance walked: ${km.toFixed(3)} km`;
  }
  function awardLabels(model) {
    const labels = [];
    if (model.firstBadge) labels.push('First Steps (4.2 km)');
    if (model.secondBadge) labels.push('Route Wanderer (12.6 km)');
    if (model.il01) labels.push('North Lawndale (17.703 km)');
    return 'Earned: ' + (labels.length ? labels.join(' · ') : 'None yet');
  }

  function render(mode, model) {
    if (currentMode !== mode || !model.firstBadge) sheet.hidden = true;
    currentMode = mode;
    // Gate: open button disabled until first badge earned
    if (open) {
      open.disabled = !model.firstBadge;
    }

    // Only update sheet contents when sheet is visible
    if (modeEl)   modeEl.textContent   = mode === 'Demo' ? 'DEMO WALK · Simulated steps' : 'MANUAL WALK · Self-reported steps';
    if (distEl)   distEl.textContent   = formatDistance(model.totalMm);
    if (awardsEl) awardsEl.textContent = awardLabels(model);

    // Card (figure) visible only when postcard has been saved
    if (card) {
      card.hidden = !(model.il01 && model.postcardSaved);
    }

    // Print button visible only when sheet is in preview (sheet itself not hidden)
    if (print) {
      print.hidden = !!(sheet && sheet.hidden);
    }
  }

  // Wire open
  if (open) {
    open.addEventListener('click', () => {
      if (open.disabled) return;
      if (sheet) sheet.hidden = false;
      close?.focus();
      if (print) print.hidden = false;
    });
  }

  // Wire close
  if (close) {
    close.addEventListener('click', () => {
      if (sheet) sheet.hidden = true;
      if (print) print.hidden = true;
      open?.focus();
    });
  }

  // Wire print
  if (print) {
    print.addEventListener('click', () => {
      window.print();
    });
  }

  // Hide sheet and print by default
  if (sheet) sheet.hidden = true;
  if (print) print.hidden = true;

  // Return the setter; each call is a full state replace — no stale carry-over
  return function setPassport(mode, model) {
    render(mode, model);
  };
}
