# Kanto 151 — catalog-first rebuild

This branch is an isolated rebuild track. It is based on the existing `main` branch, but all work here is kept separate from the production app and legacy experiments.

## Non-negotiable preservation rules

- Never delete or overwrite `main`.
- Never delete or overwrite `offline-scanner` or `visual-card-matching-prototype`.
- The legacy main snapshot is also preserved at `archive/legacy-main-2026-11-28`.
- Do not merge this branch into production until it passes the documented acceptance tests and the owner explicitly approves.

## Scope

Recognize camera photographs and uploaded images of English and Japanese Pokémon TCG cards from 1996–2002, including Kanto Pokémon (001–151). Preserve source card identity separately from physical printing identity. Only distinguish printings when source data or verified manual evidence supports the distinction.

The current data is a seed catalog, not a complete historical checklist or a verified census of every physical printing.

## Current status

- [x] Preserve the legacy application and work on an isolated rebuild branch.
- [x] Run reproducible English/Japanese TCGdex source audits.
- [x] Build a normalized catalog split into per-set files.
- [x] Add source provenance, variant records, image-gap reporting and integrity metrics.
- [x] Add canonical English/Japanese species names for all 151 Kanto Pokémon.
- [x] Use canonical species aliases in OCR candidate ranking without overwriting original TCGdex card names.
- [x] Compare the Japanese catalog against an independent vintage checklist and report missing groups/count disagreements.
- [x] Add a local catalog loader, fuzzy ranking and version-aware IndexedDB caching.
- [x] Vendor OpenCV.js, Tesseract.js, WASM runtime and English/Japanese OCR models into the repository.
- [x] Integrate card localization, perspective correction, bilingual OCR and local candidate retrieval.
- [x] Connect camera and upload flows to the local scanner pipeline.
- [x] Keep candidate selection human-confirmed; the scanner never auto-registers a card.
- [x] Cache fetched same-origin scanner assets and catalog files for subsequent offline use.
- [x] Add automated tests for catalog ranking, Japanese name aliases, OCR number parsing, app integration, data integrity and variant mapping.
- [ ] Verify camera capture, OCR quality and offline use on a real iPhone.
- [ ] Reconcile the 10 Japanese vintage groups absent from the current TCGdex audit against primary checklists.
- [ ] Add verified Japanese deck, vending, premium-file and promo records.
- [ ] Resolve image-source permissions and fill image gaps.
- [ ] Add visual card-image matching after usable, permitted reference images are available.
- [ ] Establish a labeled real-card test set and measure precision/recall.
- [ ] Manually verify physical printing distinctions and card-specific variants.

## Latest verified audit snapshot — 2026-11-28

GitHub Actions run: [#46158644732](https://github.com/y5dk674ks8-svg/kanto151-vintage/actions/runs/46158644732) — successful. All 25 automated tests passed.

- **1,668** TCGdex Kanto card records: 882 English and 786 Japanese.
- All **151/151** Kanto Pokédex IDs are represented in both languages.
- **3,072** detailed source-variant entries remain after removing 38 exact duplicate source entries.
- No duplicate record IDs or printing IDs.
- Zero first-edition stamp mismatches, Unlimited misclassifications or No Rarity misclassifications.
- **793** records have no TCGdex image URL: 7 English and 786 Japanese.
- **278** Japanese source card names do not contain the canonical Japanese or English species name associated with their dex ID. The original source name is preserved; canonical aliases are added for OCR ranking and shown alongside it.
- Independent Japanese checklist: 27 core vintage groups. The current date-filtered TCGdex audit maps 17; 10 are absent. Five matched groups have source-count disagreements.
- The supplementary promo/deck reference contains 12 entries: 6 overlap with the 27 core groups and 6 are distinct additional groups.

This is a successful **seed-catalog and scanner-pipeline milestone**, not a complete vintage catalog or a validated printing census. The largest remaining blockers are Japanese promo/deck coverage, image rights and image availability, and real-device accuracy testing.
