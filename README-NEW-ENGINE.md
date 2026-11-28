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
- [x] Add experimental perceptual visual ranking for English candidates with available reference images; Japanese candidates remain text-ranked.
- [x] Display OCR and visual scores separately; neither score is treated as a probability.
- [x] Keep candidate and printing selection human-confirmed; the scanner never auto-registers a card.
- [x] Require an explicit Pokémon choice when a source card record is ambiguous.
- [x] Cache fetched same-origin scanner assets and catalog files for subsequent offline use.
- [x] Add automated tests for catalog ranking, Japanese name aliases, OCR number parsing, visual ranking, app integration, data integrity and variant mapping.
- [ ] Verify camera capture, OCR quality and offline use on a real iPhone.
- [ ] Reconcile the 10 Japanese vintage groups absent from the current TCGdex audit against primary checklists.
- [ ] Add verified Japanese deck, vending, premium-file and promo records.
- [ ] Resolve image-source permissions and fill image gaps.
- [ ] Resolve upstream card-image reuse permissions before treating visual matching as production-ready.
- [ ] Add Japanese visual references; current Japanese catalog image coverage is absent in TCGdex.
- [ ] Establish a labeled real-card test set and measure OCR/visual precision and recall.
- [ ] Manually verify physical printing distinctions and card-specific variants.

## Latest verified audit snapshot — 2026-11-28

GitHub Actions run: [#46158869084](https://github.com/y5dk674ks8-svg/kanto151-vintage/actions/runs/46158869084) — successful. All 29 automated tests passed.

- **1,668** TCGdex Kanto card records: 882 English and 786 Japanese.
- All **151/151** Kanto Pokédex IDs are represented in both languages.
- **3,072** detailed source-variant entries remain after removing 38 exact duplicate source entries.
- No duplicate record IDs or printing IDs.
- Zero first-edition stamp mismatches, Unlimited misclassifications or No Rarity misclassifications.
- **793** records have no TCGdex image URL: 7 English and 786 Japanese.
- **278** Japanese source card names do not contain the canonical Japanese or English species name associated with their dex ID. The original source name is preserved; canonical aliases are added for OCR ranking and shown alongside it.
- Independent Japanese checklist: 27 core vintage groups. The current date-filtered TCGdex audit maps 17; 10 are absent. Five matched groups have source-count disagreements.
- The supplementary promo/deck reference contains 12 entries: 6 overlap with the 27 core groups and 6 are distinct additional groups.

The English visual matcher is experimental: it uses remote TCGdex reference-image URLs and stores derived feature descriptors locally, but upstream image rights have not been cleared. It is not a substitute for checking the actual card and printing.

This is a successful **seed-catalog and scanner-pipeline milestone**, not a complete vintage catalog or a validated printing census. The largest remaining blockers are Japanese promo/deck coverage, image rights and image availability, and real-device accuracy testing.
## Latest verified seed-catalog snapshot — 2026-11-28

GitHub Actions audit run: [#46158593772](https://github.com/y5dk674ks8-svg/kanto151-vintage/actions/runs/46158593772) — successful.

- 1,668 TCGdex Kanto card records: 882 English and 786 Japanese.
- All 151 Kanto Pokédex IDs are represented in both languages.
- 3,072 normalized source-variant entries after removing 38 exact duplicate source entries.
- No duplicate card-record IDs or duplicate printing IDs.
- Zero first-edition stamp mismatches, Unlimited misclassifications or No Rarity misclassifications.
- 793 records have no TCGdex image URL: 7 English and 786 Japanese.
- Japanese discovery references list 27 core vintage set groups and 12 supplementary deck/promo source entries. Six supplementary entries overlap core groups; six are additional discovery groups.
- TCGdex currently represents 17 of the 27 core Japanese groups. Ten are absent from its current date-scope audit.
- Five matched Japanese groups have source-count differences requiring checklist-level reconciliation.
- 278 Japanese card-title fields do not contain the canonical species name. Every record still has a canonical species alias, and both card titles and species aliases are used for ranking.

The latest scanner integration run [#46159183213](https://github.com/y5dk674ks8-svg/kanto151-vintage/actions/runs/46159183213) has passed all five test suites (33 tests); the refreshed catalog audit is still running.

This is a successful **seed-catalog audit**, not a complete vintage checklist or validated printing census. Japanese promos, vending, decks, premium files, image permissions and historical card-name differences remain open work.

## Scanner implementation

The rebuild uses local OpenCV and Tesseract assets. User photos are processed in the browser; the scanner does not upload them. The first scan downloads and caches catalog chunks, OCR runtime/models and derived English reference-image features.

For Japanese cards without a public reference image, the user can opt in to saving a local visual fingerprint after confirming a card. Only derived feature descriptors are stored in IndexedDB, not the raw photo. Later scans can use those fingerprints to rank Japanese candidates.

Text and visual scores are ranking signals, not probabilities. The scanner always asks the user to inspect and choose a candidate; automatic confirmation remains disabled.
