# How Kiro was used

Kiro CLI V3 produced the first requirements, design and task drafts. Kiro generated the ES module demo distance/award engine and unit tests, then produced a browser UI scaffold, the Manual Walk date ledger and tests, and a passport scaffold. The developer audited and corrected milestone integer arithmetic guidance, connected the actual engine and made batch IDs safe across page reloads, corrected activation-date handling and integrated the postcard and print views. Editable requirements and a focused execution checklist are under `.kiro/specs/route66-walking`.

Independent checkpoint validation ran 62 Node tests and manually exercised Demo, Manual, date corrections, postcard collection and persistence in Chrome. Print preview content was exercised, but a one-page saved PDF and the remaining stations are not yet verified for the submission. This record does not claim the entire project or art was produced by Kiro.

For the Illinois catalogue checkpoint, Kiro drafted the route data and its tests. The resulting route calculation was checked with integer millimetre boundaries across all 13 markers. The developer connected the catalogue to the existing Demo and Manual state without changing either storage format.

For the Manual Walk persistence checkpoint, Kiro drafted the storage abstraction and tests. The developer corrected the draft for the shipped v1 ledger and integrated the UI. Node tests exercised concurrent writes and unavailable storage; two Chrome tabs verified that separate dates and a saved postcard were retained and that an unsaved edit was not replaced.
