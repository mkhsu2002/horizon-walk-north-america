export const ILLINOIS_STOPS = Object.freeze([
  { id: "IL00", name: "Chicago",                              meters: 0,      teaser: "Before the open road, there was a Chicago street corner." },
  { id: "IL01", name: "North Lawndale",                       meters: 17703,  teaser: "Where the old motor row meets the elevated train." },
  { id: "IL02", name: "Joliet",                               meters: 62764,  teaser: "A river crossing with moving parts." },
  { id: "IL03", name: "Wilmington",                           meters: 109435, teaser: "The road slows down beside the Kankakee." },
  { id: "IL04", name: "Gardner",                              meters: 167372, teaser: "A railroad village with a very small jail." },
  { id: "IL05", name: "Odell",                                meters: 194731, teaser: "A gas stop built to look like a little house." },
  { id: "IL06", name: "Pontiac",                              meters: 223699, teaser: "A town that keeps the road’s stories." },
  { id: "IL07", name: "Atlanta",                              meters: 305775, teaser: "A little neon light with a job to do." },
  { id: "IL08", name: "Sherman",                              meters: 365321, teaser: "Two short ribbons of concrete." },
  { id: "IL09", name: "Springfield Region",                   meters: 394289, teaser: "The things we carry away from a road." },
  { id: "IL10", name: "Litchfield",                           meters: 452226, teaser: "The road moved; the neon followed." },
  { id: "IL11", name: "Staunton",                             meters: 477975, teaser: "A different kind of roadside sign." },
  { id: "IL12", name: "Old Chain of Rocks Bridge · Illinois Side", meters: 531084, teaser: "A chapter ends where the bridge bends." },
].map(Object.freeze));

/**
 * Given a total walked distance in millimeters, return the walker's progress
 * along the Illinois Route 66 stops.
 *
 * @param {number} totalMm - Total walked distance in millimeters. Must be a
 *   finite, non-negative safe integer.
 * @returns {{
 *   current: { id: string, name: string, meters: number, teaser: string },
 *   next: { id: string, name: string, meters: number, teaser: string } | null,
 *   remainingToNextMm: number | null,
 *   remainingToFinishMm: number
 * }}
 */
export function routeProgress(totalMm) {
  if (
    typeof totalMm !== "number" ||
    !Number.isFinite(totalMm) ||
    !Number.isSafeInteger(totalMm) ||
    totalMm < 0
  ) {
    throw new RangeError(
      `totalMm must be a finite non-negative safe integer, got ${totalMm}`
    );
  }

  const finishMm = ILLINOIS_STOPS.at(-1).meters * 1000;
  const remainingToFinishMm = Math.max(0, finishMm - totalMm);

  // Find the furthest stop the walker has reached or passed.
  let currentIndex = 0;
  for (let i = ILLINOIS_STOPS.length - 1; i >= 0; i--) {
    if (totalMm >= ILLINOIS_STOPS[i].meters * 1000) {
      currentIndex = i;
      break;
    }
  }

  const current = ILLINOIS_STOPS[currentIndex];
  const isLast = currentIndex === ILLINOIS_STOPS.length - 1;
  const next = isLast ? null : ILLINOIS_STOPS[currentIndex + 1];

  const remainingToNextMm = next === null
    ? null
    : next.meters * 1000 - totalMm;

  return { current, next, remainingToNextMm, remainingToFinishMm };
}
