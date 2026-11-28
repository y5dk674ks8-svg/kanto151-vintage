# Catalog audit

## Objective

Build a reproducible inventory of English and Japanese Pokémon TCG cards from 1996–2002 that feature one or more Kanto Pokédex IDs (001–151). Keep card identity separate from physical printing identity. Do not claim that a source record proves a complete physical-printing inventory.

## Sources

### Structured seed source

- TCGdex REST API v2: `https://api.tcgdex.net/v2/{language}/sets` and individual set/card endpoints.
- The full language set index and raw set details are retained under `catalog/audit/raw/`.
- TCGdex language catalogs have different coverage levels; the API is a seed source, not proof of historical completeness.
- Card-level variant data is source evidence, not manual verification of physical cards.

### Canonical Pokémon name reference

- `catalog/pokemon-name-reference.json` stores English and Japanese species names for Kanto dex IDs 001–151 from [PokeAPI's pokemon_species_names.csv](https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon_species_names.csv), pinned to the source commit recorded in the file.
- The Japanese spellings are cross-checkable against [Bulbapedia's list of Japanese Pokémon names](https://bulbapedia.bulbagarden.net/wiki/List_of_Japanese_Pok%C3%A9mon_names), which describes them as the official Japanese spellings.
- These are species-name aliases, not card-specific names. They let OCR match a species even where a card name contains a prefix (Rocket, Dark, Light, owner name) or the TCGdex Japanese card-name field is mistranslated.
- The original TCGdex card name is preserved unchanged. Name-alias gaps are reported for review rather than silently rewriting source data.

### Independent Japanese discovery references

- [Vintage Japanese Pokémon Cards](https://japanesepokemoncards.net/vintage): lists 27 vintage groups and 1,777 cards for 1996–2002. Its FAQ says trophy cards and most one-off promos are outside its list.
- [Japanese Poké Cards](https://japanesepokecards.com/sets/): lists Japanese set groups and separate promo/deck groups. This is a fan-maintained discovery checklist, not an official checklist.
- [PTCG Image Atlas](https://nstrelow.github.io/ptcg-image-atlas/): useful image-source research. Its repository explicitly warns that the research was AI-assisted and not hand-verified; treat source/provenance claims as leads, not facts.

Source-specific set totals are preserved separately. Do not silently reconcile disagreements or choose one count as canonical.

## Current scope and known omissions

The date-filtered TCGdex audit currently identifies 20 English sets and 17 Japanese sets. It normalizes 882 English and 786 Japanese Kanto card records. It finds all 151 Kanto dex IDs in both languages, but this does not mean all Kanto printings are present.

The independent Japanese vintage checklist contains 27 core groups. In the latest comparison:
- 17 groups map to the current date-filtered TCGdex set audit.
- 10 groups do not map to a TCGdex set in that audit: City Gym Decks, Neo Premium Files 1–3, Vending Series 1–3, CD Promo, Southern Islands and a 1998 unnumbered-promo group.
- Five core groups have count differences between the vintage checklist and TCGdex: Gym Challenge, Neo Genesis, Neo Discovery, Pokémon Card VS and Pokémon Web.
- Additional promo/deck groups are listed separately in `catalog/audit/japanese-vintage-set-reference.json`; they have not yet been reconciled card by card.

The 27-group list is a discovery checklist, not a complete universe of Japanese TCG products. Trophy cards, one-off promos and product-specific decks require separate review.

## Image status

The latest TCGdex snapshot has:
- English: 882 Kanto records; 7 without an image URL.
- Japanese: 786 Kanto records; 786 without an image URL.

A missing TCGdex image URL does not prove that no image exists elsewhere. Japanese image sources require provenance and reuse-rights review before any mirroring or redistribution. Never silently substitute an English image for a Japanese printing.

## Japanese name-data quality

A spot check found Japanese TCGdex card-name fields that do not contain the canonical species name associated with the source dex ID. For example, the current `ja:neo1-001` seed record is named `奇妙な`, while dex ID 43 is Oddish / `ナゾノクサ`. This is treated as a source-name quality gap, not silently corrected. The scanner therefore ranks against both the original card name and the canonical species aliases.

## Variant handling

- A physical printing is represented separately from the source card identity when the source exposes a distinct variant.
- First Edition is assigned only when the individual detailed variant carries a matching first-edition stamp.
- Unlimited is assigned from the individual variant's `subtype: unlimited`.
- Japanese No Rarity is assigned from `subtype: no-rarity`.
- Shadowless is kept as its own boolean distinction.
- Do not infer No Rarity, 1st Edition, Unlimited, Shadowless, holo, non-holo, reverse holo or promo stamps from card names alone.
- Every imported variant remains `unverified` until checked against a trustworthy physical-card reference.

## Audit procedure

1. Query the complete `/v2/en/sets` and `/v2/ja/sets` indexes and save raw responses.
2. Fetch set detail records to obtain release dates; preserve undated or unparseable set dates in the gap report.
3. Include all sets with release dates in the requested 1996–2002 window.
4. Fetch card detail records and retain cards whose `dexId` includes an integer from 1 through 151.
5. Preserve raw collector numbers, source IDs, source URLs, image URLs, detailed variants and retrieval timestamps.
6. Compare the API inventory with the independent Japanese discovery checklist.
7. Report image gaps, source count conflicts, missing set groups and variant integrity checks.
8. Run loader tests and generated-data integrity tests after each audit.
9. Do not merge the rebuild branch into production until the owner explicitly approves and acceptance tests pass.

## Deliverables

- `catalog/audit/raw/`: raw source snapshots.
- `catalog/audit/coverage.json`: counts and coverage by language, Japanese checklist comparison and validation metrics.
- `catalog/audit/gaps.csv`: missing images, missing/unknown source data and other detected gaps.
- `catalog/cards/{language}/{setId}.json`: normalized per-set records.
- `catalog/index.json`: lightweight set index for lazy loading.
- `catalog/card-record.schema.json`: normalized record schema.
- `src/catalog-loader.mjs`: local set loading, caching, text normalization and candidate ranking.
- `tests/`: loader and generated-catalog integrity tests.

## Completion rule

The API audit is not complete merely because it returned successfully. It is complete only when the inventory is reproducible, omissions and source disagreements are explicit, variant claims are tested against per-variant evidence, and the image source and reuse rights are documented. The full historical catalog is not yet complete.
