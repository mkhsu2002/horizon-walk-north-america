# Product Specification: The Route 66 Challenge

**Status:** planned, not implemented. **Entry:** Kiroween 2026, Frankenstein. **Primary language:** English.

## 1. Product goal

Turn everyday walking, anywhere, into a long-distance virtual journey. The new North American edition follows the story of historic U.S. Route 66 from Chicago to Santa Monica. Physical movement unlocks virtual places, and the resulting digital collection becomes a printable paper travel passport. The passport reflects what the walker has actually unlocked; it is not a route planner, navigation app or blank printable template.

## 2. Journey and release scope

- Show the full Chicago-to-Santa Monica journey as an eight-state overview. The National Park Service describes it as roughly 2,400 miles; historical alignments changed. Store a single sourced, versioned virtual distance model; do not present it as an official walking itinerary or imply the same distance applies to every historic alignment.
- Provide one complete first chapter in Illinois, starting in Chicago. Candidate story anchors: Grant Park, the Joliet/Wilmington corridor, the historic station in Odell, and the Illinois approach to Chain of Rocks Bridge. Publish an anchor only after verifying its source, sequence, virtual distance and media rights. The rest of the route may be visibly labeled “preview”; never present unbuilt chapters as playable.
- Target the first useful story reward in about 3 days at 6,000 steps/day on a default 0.70 m conversion (~4.2 km/day). Once per chapter, allow an accurately labeled progress milestone between major landmarks rather than moving a real place to make it unlock sooner. Carry cumulative distance forward; no daily resets or streak penalties. Offer miles for readers and store base units consistently.
- Primary app: Android-first English experience with permission-gated OS step input where available. Confirm the input path on a real phone before calling it supported. Reviewer path: sign-in-free browser demo using clearly labeled sample walking and the same unlock rules; simulated progress must never enter a real journey. Other platforms, background reliability claims, cycling, leaderboard, billing and accounts are out of scope.

## 3. Required product path

1. **Start:** understand that local walking counts toward a virtual journey; pick the Route 66 challenge and start in Chicago.
2. **Walk:** see daily steps, cumulative progress and distance to the next unlock. Reimport or recheck overlapping step records without adding them twice. If permission is declined or data is unavailable, show that status without fabricating steps.
3. **Arrive:** a threshold crossing unlocks the relevant story and original or cleared postcard once, including when several thresholds are crossed between opens. Reopening must preserve progress and the collection. The first chapter can be read offline once the assets are available locally.
4. **Print:** generate one letter-size, high-contrast passport sheet showing only earned stamps and postcards. Browser print-to-PDF is acceptable. Export by explicit user action; don't include raw steps, GPS, account identifiers or personal data.
5. **Review:** a reviewer completes start → sample walking → unlock → print in a short run without login. Clearly distinguish virtual progress and fictional sample inputs from real device readings.

## 4. Acceptance gates

- Test below, exactly at and above an unlock threshold; crossing the same threshold again never duplicates the stamp. Verify repeated step import and reopening preserve totals.
- Verify an Android real-step session and a denied-permission session separately. No location permission, tracking of a real route, or uploads of raw health data; real progress remains on the device for the MVP.
- Independently verify the deployed browser demo, keyboard/touch access, narrow-screen layout, and a printed or PDF Letter sheet: legible, not clipped, matches the earned collection.
- Evaluate North American and future comparison cohorts using comparable first-week first-unlock and second-week return measures, plus postcard collection rate when earned. Do not compare full-route completion across different route lengths or attribute outcome differences to the route alone if interface or cohorts also differ. No new telemetry required to ship the MVP.
- At submission: include the working app URL, public repository and appropriate open-source license, root Kiro-generated artifacts and truthful Kiro usage summary, and a public YouTube demo under three minutes. Create implementation and substantive Kiro artifacts during the submission period. Disclose prior work or assets if ever incorporated; do not copy the separate Asia app. Keep all credentials, signup details, private notes and data out of this repository.

## Sources

- [National Park Service: Route 66](https://home.nps.gov/articles/000/route-66-national.htm)
- [National Park Service: Illinois listings](https://www.nps.gov/articles/000/route-66-illinois.htm)
- [Kiroween 2026 Official Rules](https://kiroween.devpost.com/rules)
