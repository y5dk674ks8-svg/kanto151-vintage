# Architecture — catalog-first scanner

## Decision

Use a local, catalog-backed recognition pipeline. Do not train a new neural model as the first step. Do not make a paid cloud vision API a runtime dependency.

The scanner must support:
1. Camera capture of a physical card.
2. Upload of an existing image.
3. English and Japanese vintage cards from 1996–2002.
4. All relevant sets and promos in that period that contain a Kanto Pokédex Pokémon.
5. Explicit handling of printings and variants, with uncertainty exposed to the user.

## Pipeline

1. **Input** — camera or file upload.
2. **Card localization** — detect the card boundary and rectify perspective. Reuse and evaluate the existing OpenCV card detector rather than rewriting it without evidence.
3. **Independent evidence extraction**
   - OCR: card name, collector number, set text, language clues.
   - Visual features: full-card, artwork, footer/collector-number area and layout.
4. **Candidate retrieval** — query the local catalog using any reliable evidence. OCR must never hard-exclude candidates when it is uncertain.
5. **Candidate ranking** — combine normalized text evidence and visual similarity. Calibrate scores against labeled examples; never label an arbitrary similarity score as a probability.
6. **Decision policy**
   - Show ranked candidates when evidence is ambiguous.
   - Auto-confirm only after validation against a held-out test set and a conservative false-accept threshold.
   - Ask for another image or manual selection when variants are not visually distinguishable.
7. **Local persistence** — cache catalog and user collection in IndexedDB. Scanning must work offline after catalog installation.

## Data source strategy

TCGdex is the primary seed source because it provides a public multilingual API and card/set metadata. It is not treated as a complete authority for every historical printing. Its own documentation notes that language catalogs have different completion levels and that variant data is being improved.

Therefore:
- Enumerate all sets from each selected language; do not use a hard-coded shortlist of set names.
- Select candidate sets by release date and card membership, not name matching alone.
- Fetch full card records for cards with Kanto dex IDs 1–151.
- Record missing metadata and images explicitly.
- Maintain a separate, provenance-tracked manual supplement for verified historical printing distinctions that TCGdex does not represent.
- Never infer Shadowless, Unlimited, No Rarity, holofoil or other printing details solely from a broad card-level record.

## Recognition technology

Initial low-complexity implementation:
- Existing OpenCV.js card localization, subject to regression testing.
- Existing Tesseract.js runtime for offline OCR, subject to language/model coverage checks.
- Existing visual matcher as a baseline, not as a trusted source of confidence.
- A deterministic catalog index keyed by language, set, card ID, collector number and Kanto dex ID.
- Perceptual/image features computed once for catalog images and cached locally.

Compare a simple pHash baseline with the existing spatial visual descriptor before choosing the production visual ranker. Do not assume pHash alone can distinguish near-identical reprints.

## Variant model

Separate these concepts:
- Card identity: the catalog card record (set + card ID / collector number).
- Printing: a physical printing of that card.
- Variant: e.g. normal, holo, reverse, first edition, promo stamp, shadowless, Japanese No Rarity.
- Language.
- Finish/foil treatment.
- Evidence and provenance for every asserted distinction.

A single image may not prove all properties. Store `unknown` rather than inventing a value.

## Validation

Create a labeled benchmark split by card identity and printing:
- clean scans;
- phone photos at varied angles;
- sleeves and top loaders;
- glare/reflections;
- different backgrounds and lighting;
- English and Japanese;
- near-identical printings and reprints;
- missing/blurred collector numbers.

Report separately:
- top-1 card identity accuracy;
- top-3 card identity recall;
- exact printing/variant accuracy;
- OCR field accuracy;
- false automatic confirmations;
- catalog coverage and image availability.

No production release based on a single aggregate accuracy number.
