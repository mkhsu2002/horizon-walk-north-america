# Horizon: Walk the World — North America

**Route 66 Challenge · Kiroween 2026 · Frankenstein**

Walk anywhere. Challenge yourself. Discover Route 66. The project combines a virtual walking challenge with postcards and a paper travel passport that reflects earned progress.

## First playable preview

[Open the Route 66 preview](https://walk.horizonoutdoor.ca/). The English-language preview shows all 13 Illinois stops and the remaining walking distance to the next one. North Lawndale is the only collectible postcard in this release. Take a labelled Demo Walk with simulated steps, or record daily totals in a separate Manual Walk. The preview awards two challenge badges, lets you save the first postcard and unlocks a printable passport after the first badge. It does not read phone sensors, ask for login, or upload steps. It is not navigation or a record of an in-person visit.

Manual progress is stored in this browser. Use a current browser on the same site address, and reload any tabs left open from an older preview before recording new steps.

Run locally from the repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory web
node --test tests/*.test.mjs
```

Open http://127.0.0.1:8080. For the passport, select **Print / Save PDF** and use your browser's print dialog. It targets US Letter portrait. When deploying to Cloudflare Pages with Git integration, use no framework preset and output directory `web`; no application build step is needed for this preview.

[Product scope](docs/PRODUCT-SPEC.md) · [Illinois chapter plan](docs/ILLINOIS-STATION-PLAN.md) · [Kiro workflow](docs/KIRO-DEVELOPMENT.md) · [Media credits](docs/MEDIA-CREDITS.md)

**Not yet in this preview:** the remaining Illinois postcards, offline PWA support, direct PDF export or any Android health integration. This checkpoint is not the final submission.
