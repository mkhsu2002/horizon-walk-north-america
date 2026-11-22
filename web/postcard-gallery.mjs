import { POSTCARD_MEDIA } from './postcard-media.mjs';
import { ILLINOIS_STOPS } from './route-catalog.mjs';
export function postcardFigure(asset) {
  const figure = document.createElement('figure');
  figure.className = 'postcard-art';
  const img = document.createElement('img');
  img.src = asset.src; img.alt = asset.alt; img.loading = 'lazy';
  img.width = asset.width; img.height = asset.height;
  const caption = document.createElement('figcaption'); caption.textContent = asset.caption;
  const details = document.createElement('details');
  const label = document.createElement('summary'); label.textContent = 'Image credit and sources';
  const credit = document.createElement('p'); credit.textContent = asset.credit;
  details.append(label,credit);
  const addLink=(text,url)=>{
    if (typeof url !== 'string' || !url.startsWith('https://')) return;
    const item=document.createElement('p'), link=document.createElement('a');
    link.href=url; link.textContent=text; item.append(link); details.append(item);
  };
  addLink('Original image source',asset.source);
  addLink(asset.rights,asset.rightsUrl);
  addLink('Read more about this stop',asset.storySource);
  if (asset.editNote) {
    const change=document.createElement('p'); change.textContent=asset.editNote; details.append(change);
  }
  figure.append(img, caption, details);
  return figure;
}

export function renderGallery(container, status, shelf, save, { media = POSTCARD_MEDIA, excludeId } = {}) {
  const nodes = ILLINOIS_STOPS.filter(stop => stop.id !== excludeId && Object.hasOwn(media, stop.id) && shelf.earned.includes(stop.id)).map(stop => {
    const asset = media[stop.id];
    const box = document.createElement('article');
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'btn-secondary';
    button.disabled = shelf.saved.includes(stop.id);
    button.textContent = (button.disabled ? 'Saved: ' : 'Save postcard: ') + stop.name;
    button.addEventListener('click', async () => {
      try { await save(stop.id); status.textContent = 'Postcard saved: ' + stop.name; }
      catch { status.textContent = 'This postcard could not be saved safely.'; }
    });
    const title=document.createElement('h3'); title.textContent=stop.name;
    box.append(title, postcardFigure(asset));
    if (asset.story) {
      const story=document.createElement('p'); story.textContent=asset.story; box.append(story);
    }
    box.append(button);
    return box;
  });
  container.replaceChildren(...nodes);
}
