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
- [x] Cross-check Japanese vintage coverage against 27 core set groups and 12 additional deck/promo groups.
- [x] Add a metadata-based candidate ranker and local catalog loader.
- [x] Add IndexedDB caching for catalog index and per-set records.
- [x] Add automated tests for text normalization, Japanese kana, number parsing, candidate ranking, catalog integrity and variant mapping.
- [x] Review the preserved OpenCV card detector and legacy visual matcher for reuse.
- [ ] Reconcile the 10 core Japanese set groups missing from TCGdex against primary checklists.
- [ ] Add verified Japanese deck, vending, premium-file and promo records.
- [ ] Resolve image-source permissions and fill image gaps.
- [ ] Port card localization and integrate OCR into the new scanner UI.
- [ ] Port visual ranking after image coverage and permissions are resolved.
- [ ] Add OCR and visual ranking as independent signals.
- [ ] Establish a labeled test set and measure precision/recall.
- [ ] Integrate camera and upload flows.


## Latest verified audit snapshot — 2026-11-28

GitHub Actions run: [#46157621131](https://github.com/y5dk674ks8-svg/kanto151-vintage/actions/runs/46157621131) — successful. Both test suites passed (10 tests total).

- 1,668 TCGdex Kanto card records: 882 English and 786 Japanese.
- All 151 Kanto Pokédex IDs are represented in both languages.
- 3,072 source detailed-variant entries after removing 38 exact duplicate source entries.
- No duplicate record IDs or duplicate printing IDs.
- Zero first-edition stamp mismatches, Unlimited misclassifications or No Rarity misclassifications.
- 793 records have no TCGdex image URL: 7 English and 786 Japanese.
- Independent Japanese reference: 27 core vintage set groups plus 12 additional promotional/deck groups. The date-filtered TCGdex audit currently includes 17 core groups; 10 core groups are absent.
- Five matched Japanese groups have source-count differences requiring checklist-level reconciliation.

This is a successful **seed-catalog audit**, not a complete vintage checklist or validated printing census. Japanese promos, vending, decks, premium files and image permissions remain open work.
