import { createShelf, syncShelf, savePostcard, shelfStorageKey } from './postcard-shelf.mjs';
import { ILLINOIS_STOPS } from './route-catalog.mjs';
import { POSTCARD_MEDIA } from './postcard-media.mjs';

const mode = 'Manual';
export const MANUAL_SHELF_KEY = shelfStorageKey(mode);
const known = new Set(ILLINOIS_STOPS.slice(1).map(({id}) => id));
const ready = id => Object.hasOwn(POSTCARD_MEDIA, id);
const list = ids => Array.isArray(ids) && ids.length === new Set(ids).size && ids.every(id => known.has(id));

export function createManualPostcards(storage) {
  function read() {
    const raw = storage.getItem(MANUAL_SHELF_KEY);
    if (raw === null) return createShelf(mode);
    const data = JSON.parse(raw);
    const shelf = data?.state;
    if (data?.version !== 1 || shelf?.mode !== mode || !list(shelf.earned) || !list(shelf.saved) ||
        !shelf.saved.every(id => shelf.earned.includes(id) && (id === 'IL01' || ready(id)))) {
      throw new TypeError('Invalid Manual postcard collection');
    }
    return shelf;
  }
  // Caller holds the same exclusive lock as the Manual ledger.
  function sync(ledger, id) {
    const current = read();
    if (!ledger) {
      if (id !== undefined) throw new Error('Manual challenge is not available');
      return current;
    }
    if (id !== undefined && !ready(id)) throw new Error('Postcard is not available');
    let next = syncShelf(current, mode, ledger.totalMm, {
      legacyIL01Earned: ledger.awards.il01,
      legacyIL01Saved: ledger.postcardSent,
    });
    if (id !== undefined) {
      if (!next.earned.includes(id)) throw new Error('Postcard is locked');
      next = savePostcard(next, mode, id);
    }
    if (next !== current) storage.setItem(MANUAL_SHELF_KEY, JSON.stringify({version:1,state:next}));
    return next;
  }
  return {read, sync};
}
