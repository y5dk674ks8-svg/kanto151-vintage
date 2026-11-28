# Kanto 151 — catalog-first rebuild

This branch is an isolated rebuild track. It is based on the existing `main` branch, but all work here is kept separate from the production app and legacy experiments.

## Preservation rules

- Never delete or overwrite `main`.
- Never delete or overwrite `offline-scanner` or `visual-card-matching-prototype`.
- The legacy main snapshot is preserved at `archive/legacy-main-2026-11-28`.
- Do not merge this branch into production until it passes the documented acceptance tests and the owner explicitly approves.

## Scope

Recognize camera photographs and uploaded images of English and Japanese Pokémon TCG cards from 1996–2002, including Kanto Pokémon (001–151). Preserve source card identity separately from physical printing identity. Only distinguish printings when source data or verified manual evidence supports the distinction.

The current data is a seed catalog, not a complete historical checklist or a verified census of every physical printing.

## Implemented

- [x] Preserve the legacy application and work on an isolated rebuild branch.
- [x] Audit English and Japanese TCGdex sources and normalize per-set records.
- [x] Add source provenance, raw snapshots, image-gap reporting and variant-integrity metrics.
- [x] Add canonical English and Japanese species names for all 151 Kanto Pokémon.
- [x] Rank OCR results against both source card names and canonical species aliases without rewriting source data.
- [x] Compare Japanese coverage against independent vintage set and promo/deck references.
- [x] Load catalog sets locally with version-aware IndexedDB caching.
- [x] Vendor OpenCV.js, Tesseract.js, WASM runtime and English/Japanese OCR models into the repository.
- [x] Integrate card localization, perspective correction, bilingual OCR and local candidate retrieval.
- [x] Add experimental perceptual visual ranking for English candidates with available reference images.
- [x] Let users optionally save local visual fingerprints after confirming a card and printing; the raw camera photo is not stored.
- [x] Use those opt-in personal references to help rank later scans, including Japanese cards without TCGdex images.
- [x] Require human confirmation of the Pokémon, card and printing; ambiguous cards cannot silently default to Bulbasaur.
- [x] Cache fetched same-origin assets and catalog files for subsequent offline use.
- [x] Add automated tests for loader, bilingual aliases, OCR parsing, visual ranking, app integration, data integrity and variant mapping.

## Latest verified snapshot — 2026-11-28

GitHub Actions run: [#46159511187](https://github.com/y5dk674ks8-svg/kanto151-vintage/actions/runs/46159511187) — successful. **All 32 automated tests passed.**

| Metric | Result |
|---|---:|
| Normalized Kanto card records | 1,668 |
| English records | 882 |
| Japanese records | 786 |
| Kanto Pokédex IDs represented | 151/151 in both languages |
| Detailed source-variant entries | 3,072 |
| Exact duplicate source-variant entries removed | 38 |
| Duplicate record / printing IDs | 0 / 0 |
| First Edition / Unlimited / No Rarity mapping errors | 0 / 0 / 0 |
| Missing TCGdex image URLs | 793 (7 English, 786 Japanese) |
| Japanese source card names without canonical species-name match | 278 |

The 278 Japanese name flags do **not** mean 278 cards are missing. They mean the TCGdex card-name field does not contain the canonical species name for the associated dex ID. The source name is preserved, while the canonical alias is used for OCR ranking and shown in the candidate list.

### Japanese set coverage

- Independent vintage checklist: 27 core groups / 1,777 listed cards.
- Current date-filtered TCGdex audit: 17 groups present, 10 core groups absent.
- Supplementary promo/deck references: 12 entries, representing 5 additional distinct groups and 7 overlaps with the core checklist.
- Five set-count comparisons disagree across the source checklists and TCGdex set/card data.
- The missing groups currently have set-level references only; their card-level records have not yet been imported and verified.

### Visual matching and privacy

- English visual ranking is experimental and uses remote TCGdex reference-image URLs. Upstream image rights are not established by the TCGdex card-data licence, so this is not production-cleared.
- Japanese visual ranking starts with OCR/text. If the user opts in after confirming a card and printing, a compact visual feature descriptor is saved locally and can help rank future scans.
- The original camera photo is not stored by this feature. Personal visual references stay in local IndexedDB; they are not uploaded by this scanner.
- OCR models and catalog data need to be fetched on first use. The service worker caches same-origin assets and catalog files as they are fetched; later use can work offline once the needed resources are cached. External image references may still need an initial network fetch.

## Remaining work

1. Import and verify card-level records for the 10 missing Japanese core groups and 5 distinct supplementary promo/deck groups.
2. Resolve image-source permissions and improve image coverage, especially for Japanese vintage cards.
3. Test camera capture, OCR, local fingerprint storage and offline behavior on a real iPhone.
4. Build a labeled real-card test set and measure OCR/visual precision and recall.
5. Manually verify physical printing distinctions and card-specific variants before calling the catalog complete.

This is a successful **scanner-pipeline and seed-catalog milestone**, not a complete vintage catalog or a validated printing census.
