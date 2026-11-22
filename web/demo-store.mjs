import { createState } from './step-engine.mjs';
import { createShelf, syncShelf, savePostcard } from './postcard-shelf.mjs';
import { ILLINOIS_STOPS } from './route-catalog.mjs';
import { POSTCARD_MEDIA } from './postcard-media.mjs';

const ready=id=>Object.hasOwn(POSTCARD_MEDIA,id);
const ids=new Set(ILLINOIS_STOPS.slice(1).map(stop=>stop.id));
function demoShelf(doc) {
  return syncShelf(doc.shelf,'Demo',doc.state.totalMm,{
    legacyIL01Earned:doc.state.awarded.has(17_703_000),legacyIL01Saved:doc.postcardSaved,
  });
}
function validShelf(s) {
  return s?.mode==='Demo' && unique(s.earned,id=>ids.has(id)) &&
    unique(s.saved,id=>s.earned.includes(id)&&(id==='IL01'||ready(id)));
}


const MILESTONES = [4_200_000, 12_600_000, 17_703_000];

export const LEGACY_DEMO_KEY = 'horizon.route66.demo.v1';
export const DEMO_STORAGE_KEY = 'horizon.route66.demo.v2';
export const INITIAL_GENERATION = 'legacy';
export class DemoResetConflict extends Error {}
const unique = (v, pred) => Array.isArray(v) && new Set(v).size === v.length && v.every(pred);
const empty = generation => ({generation,state:createState(),postcardSaved:false,shelf:createShelf('Demo')});

function decode(raw, legacy) {
    if (raw === null) return empty(INITIAL_GENERATION);
    const p = JSON.parse(raw);
    if (!p || !Number.isSafeInteger(p.totalMm) || p.totalMm < 0 || p.totalMm % 700 ||
        !unique(p.seenIds, id=>typeof id==='string' && id.length>0) ||
        !unique(p.awarded, mm=>MILESTONES.includes(mm) && mm<=p.totalMm) ||
        typeof p.postcardSaved !== 'boolean' || (p.postcardSaved && !p.awarded.includes(17_703_000)) ||
        (!legacy && (p.version !== 2 || typeof p.generation!=='string' || !p.generation))) {
      throw new TypeError('Invalid saved Demo progress');
    }
    if (!legacy && p.shelf !== undefined && !validShelf(p.shelf)) throw new TypeError('Invalid saved Demo shelf');
    const doc={generation:legacy?INITIAL_GENERATION:p.generation,state:{totalMm:p.totalMm,seenIds:new Set(p.seenIds),awarded:new Set(p.awarded)},postcardSaved:p.postcardSaved,shelf:(!legacy && p.shelf)||createShelf('Demo')};
    return {...doc,shelf:demoShelf(doc)};
  }

export function readDemoAuthority(storage) {
  const raw = storage.getItem(DEMO_STORAGE_KEY);
  return raw === null ? decode(storage.getItem(LEGACY_DEMO_KEY), true) : decode(raw, false);
}

export function createDemoStore({ storage, locks, newGeneration }) {
  const read=()=>readDemoAuthority(storage);
  function write(doc) {
    storage.setItem(DEMO_STORAGE_KEY,JSON.stringify({version:2,generation:doc.generation,totalMm:doc.state.totalMm,
      seenIds:[...doc.state.seenIds],awarded:[...doc.state.awarded],postcardSaved:doc.postcardSaved,shelf:doc.shelf}));
  }
  function underLock(action) {
    if (typeof locks?.request !== 'function') throw new Error('Safe Demo writes require Web Locks');
    return locks.request(DEMO_STORAGE_KEY,{mode:'exclusive'},action);
  }
  async function initialize() {
    return underLock(()=>{
      const current=read();
      if (storage.getItem(DEMO_STORAGE_KEY) === null) write(current);
      return current;
    });
  }
  async function transact(observedGeneration, mutator) {
    return underLock(()=>{
      const current=read();
      if (observedGeneration!==current.generation) throw new DemoResetConflict('Demo was reset in another tab.');
      const changed=mutator(current);
      const shelf=demoShelf(changed);
      const next=shelf===changed.shelf?changed:{...changed,shelf};
      if(next!==current || storage.getItem(DEMO_STORAGE_KEY) === null) write(next);
      return next;
    });
  }
  function reset(observedGeneration) {
    return transact(observedGeneration,current=>{
      const generation=newGeneration();
      if(typeof generation!=='string'||!generation||generation===current.generation||generation===INITIAL_GENERATION) throw new Error('Invalid reset generation');
      return empty(generation);
    });
  }
  function save(observedGeneration,id) {
    return transact(observedGeneration,current=>{
      if(!current.shelf.earned.includes(id) || !(id === 'IL01' ? current.state.awarded.has(17_703_000) : ready(id))) {
        throw new Error('Postcard is unavailable or locked');
      }
      const shelf=savePostcard(current.shelf,'Demo',id);
      return shelf===current.shelf?current:{...current,shelf,postcardSaved:current.postcardSaved || id==='IL01'};
    });
  }
  return {read,initialize,transact,reset,save};
}
