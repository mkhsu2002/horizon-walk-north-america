import { ILLINOIS_STOPS, routeProgress } from './route-catalog.mjs';

let mode = 'Demo';
const byId = id => document.getElementById(id);
const region = byId('route-progress');
const stopsList = byId('route-stops');
const cards = new Map();
const distanceLabel = (mm, digits = 3) => new Intl.NumberFormat('en-US', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
}).format(mm / 1e6) + ' km';
const remainingLabel = mm => mm < 1000
  ? (mm / 1000).toFixed(3) + ' m'
  : distanceLabel(mm, 6).replace(/(\.\d*?[1-9])0+ km$|\.0+ km$/, '$1 km');

for (const stop of ILLINOIS_STOPS) {
  const row = document.createElement('li');
  row.className = 'route-stop';
  const title = document.createElement('h3');
  title.textContent = stop.name;
  const tag = document.createElement('strong');
  tag.className = 'route-stop-status';
  const story = document.createElement('p');
  story.textContent = stop.teaser;
  const extra = document.createElement('p');
  extra.textContent = distanceLabel(stop.meters * 1000) + ' from Chicago · ' + (stop.id === 'IL00'
    ? 'Chapter start' : stop.id === 'IL01' ? 'Collectible postcard' : 'Collectible coming later');
  row.append(title, tag, story, extra);
  stopsList.append(row);
  cards.set(stop.id, { row, tag });
}

function totalDistance() {
  try {
    const raw = JSON.parse(localStorage.getItem('horizon.route66.' + mode.toLowerCase() + '.v1'));
    const mm = (mode === 'Demo' ? raw?.totalMm : raw?.state?.totalMm) ?? 0;
    return Number.isSafeInteger(mm) && mm >= 0 ? mm : 0;
  } catch { return 0; }
}
function update(nextMode = mode) {
  mode = nextMode;
  const mm = totalDistance();
  const progress = routeProgress(mm);
  byId('route-mode').textContent = mode.toUpperCase() + ' WALK';
  region.textContent = progress.next
    ? 'Latest stop: ' + progress.current.name + ' · Next: ' + progress.next.name + ' in ' + remainingLabel(progress.remainingToNextMm)
    : 'Illinois chapter complete · ' + progress.current.name;
  for (const stop of ILLINOIS_STOPS) {
    const { row, tag } = cards.get(stop.id);
    const status = stop.id === progress.current?.id ? 'Current stop'
      : stop.id === progress.next?.id ? 'Next stop'
      : stop.meters * 1000 <= mm ? 'Reached' : 'Upcoming';
    row.dataset.routeStatus = status;
    if (tag.textContent !== status) tag.textContent = status;
    if (status === 'Current stop') row.setAttribute('aria-current','step');
    else row.removeAttribute('aria-current');
  }
}
byId('mode-demo').addEventListener('click', () => update('Demo'));
byId('mode-manual').addEventListener('click', () => update('Manual'));
byId('demo-panel').addEventListener('click', () => queueMicrotask(() => update()));
byId('manual-form').addEventListener('submit', () => queueMicrotask(() => update()));
addEventListener('storage', e => {
  if (e.key === null || e.key === 'horizon.route66.' + mode.toLowerCase() + '.v1') update();
});
update();
