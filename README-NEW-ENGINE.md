# Kanto 151 — catalog-first rebuild

This branch is an isolated rebuild track. It is based on the existing `main` branch, but all work here is kept separate from the production app and legacy experiments.

## Non-negotiable preservation rules

- Never delete or overwrite `main`.
- Never delete or overwrite `offline-scanner` or `visual-card-matching-prototype`.
- The legacy main snapshot is also preserved at `archive/legacy-main-2026-11-28`.
- Do not merge this branch into production until it passes the documented acceptance tests and the owner explicitly approves.

## Scope

Recognize both camera photographs of physical cards and uploaded card images.

Initial catalog scope: English and Japanese Pokémon TCG cards released from 1996 through 2002, covering every relevant set and promo found in the source audit, and every Kanto Pokédex Pokémon (001–151). Include printings and variants as separate records only when the source data or a verified manual supplement can distinguish them.

Do not claim that a printing variant is identified if the photo or catalog cannot distinguish it.

## Current status

- [x] Legacy repositories and branches located.
- [x] Preservation branch created.
- [x] Isolated rebuild branch created from production main.
- [x] Run the first reproducible English/Japanese TCGdex source audit.
- [x] Build a normalized seed catalog split into per-set files.
- [x] Add unique-record, Kanto coverage, source-variant and image-gap metrics.
- [x] Cross-check Japanese vintage set coverage against an independent 27-group reference list.
- [ ] Reconcile the 10 Japanese set groups missing from TCGdex against primary checklists.
- [ ] Add verified Japanese deck, vending, premium-file and promo records.
- [ ] Resolve image-source permissions and fill image gaps.
- [ ] Build deterministic candidate retrieval.
- [ ] Add OCR and visual ranking as independent signals.
- [ ] Establish a labeled test set and measure precision/recall.
- [ ] Integrate camera and upload flows.


## First audit snapshot — 2026-11-28

GitHub Actions run: [#46157221267](https://github.com/y5dk674ks8-svg/kanto151-vintage/actions/runs/46157221267) — successful.

- 1,668 TCGdex Kanto card records: 882 English and 786 Japanese.
- All 151 Kanto Pokédex IDs are represented in both languages.
- 3,110 source detailed-variant entries are represented across the imported records.
- 793 records have no TCGdex image URL: 7 English and 786 Japanese.
- 17 Japanese set groups matched in TCGdex against an independent 27-group vintage checklist; 10 reference groups are not present in the current TCGdex date-scope audit.
- Five matched Japanese set groups have differing source card totals and require checklist-level reconciliation.
- Record IDs are unique; no record is missing a Kanto dex ID or source variant entry.

This is a successful **seed-catalog audit**, not a complete vintage checklist or a validated printing census. Japanese promos, vending, decks, premium files and image permissions remain open work.
