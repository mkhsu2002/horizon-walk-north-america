import { ILLINOIS_STOPS } from './route-catalog.mjs';
import { POSTCARD_MEDIA } from './postcard-media.mjs';

export function passportStamps(saved, legacyIL01Saved) {
  const set=new Set(Array.isArray(saved)?saved:[]);
  return ILLINOIS_STOPS.filter(s=>s.id==='IL01'?legacyIL01Saved===true:Object.hasOwn(POSTCARD_MEDIA,s.id)&&set.has(s.id));
}

export function initPassport(root) {
  const helper  = root.querySelector('[data-passport-helper]');
  const open    = root.querySelector('[data-passport-open]');
  const sheet   = root.querySelector('[data-passport-sheet]');
  const modeEl  = root.querySelector('[data-passport-mode]');
  const distEl  = root.querySelector('[data-passport-distance]');
  const noteEl = root.querySelector('[data-passport-note]');
  const awardsEl= root.querySelector('[data-passport-awards]');
  const card    = root.querySelector('[data-passport-card]');
  const stampList = root.querySelector('[data-passport-stamps]');
  const stampTitle = root.querySelector('[data-passport-stamp-title]');
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

    if (noteEl) {
      noteEl.textContent = model.journeyNote || '';
      noteEl.hidden = !model.journeyNote;
    }

    const stamps = passportStamps(model.saved, model.il01 && model.postcardSaved);
    if (helper) {
      const count = (mode === 'Demo' ? 'Demo Walk' : 'Manual Walk') + ': ' + stamps.length + ' of 12 postcards saved.';
      const gate = model.firstBadge ? '' : ' Your first badge unlocks the passport.';
      helper.textContent = count + gate + ' Print it on US Letter paper or save it as a PDF.';
    }
    card.hidden = !stamps.some(s=>s.id==='IL01');
    stampTitle.textContent = 'Postcard stamps · ' + stamps.length + ' of 12';
    stampList.dataset.count = String(stamps.length);
    for (const figure of stampList.querySelectorAll('[data-stamp-id]')) figure.remove();
    for (const {id,name} of stamps) {
      if (id === 'IL01') continue;
      const art = POSTCARD_MEDIA[id];
      const figure = document.createElement('figure');
      figure.dataset.stampId = id;
      const img = document.createElement('img');
      img.src=art.src; img.alt=art.alt; img.width=art.width; img.height=art.height;
      const label=document.createElement('figcaption');
      label.textContent=id+' · '+name;
      const credit=document.createElement('small');
      const isIllustration=art.kind.includes('illustration');
      const author=isIllustration?'Horizon illustration':art.credit.split(',')[0];
      if (!isIllustration && art.source?.startsWith('https://')) {
        const original=document.createElement('a');
        original.href=art.source; original.textContent=author; credit.append(original);
      } else credit.append(author);
      if (art.shareAlike) {
        const license=document.createElement('a');
        license.href=art.rightsUrl; license.textContent='CC BY-SA 2.0';
        credit.append(' · ',license,' · WebP edition');
      }
      credit.title=art.credit;
      label.append(credit);
      figure.append(img,label);
      stampList.append(figure);
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
