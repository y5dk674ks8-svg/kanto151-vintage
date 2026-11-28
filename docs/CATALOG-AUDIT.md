# Catalog audit

## Objective

Produce a reproducible inventory of every relevant English and Japanese TCGdex set/card released from 1996 through 2002 that includes one or more Kanto dex IDs 1–151. Include promo and special releases where the source exposes them. Do not limit the inventory to the existing QUICK_SETS list.

## Source limitations to record

- TCGdex supports multiple languages, but its documentation says language catalogs have different completion levels.
- TCGdex's FAQ says variant data is being improved. A card-level record must not be assumed to enumerate every historical physical printing.
- TCGdex is a seed catalog, not proof that every card image or printing variant is present.

## Audit procedure

1. Query `/v2/en/sets` and `/v2/ja/sets`; save the raw response and retrieval timestamp.
2. Fetch each set detail record and classify by release date 1996-01-01 through 2002-12-31. Preserve sets with unknown dates in a separate review list rather than silently dropping them.
3. Include all qualifying sets, including promo/special sets, regardless of whether they appear in the app's existing quick-search buttons.
4. Fetch each card detail record. Retain cards whose `dexId` includes any integer 1–151. Keep multi-dex cards and non-numeric collector IDs intact.
5. Record per-language counts: sets, qualifying sets, cards, unique Kanto dex IDs, cards with images, cards without images, and fetch failures.
6. Compare English and Japanese coverage by Pokémon and set family. Do not assume matching coverage.
7. Audit `variants` and `variants_detailed` where present. Record absent or ambiguous historical distinctions as gaps.
8. Produce a manual gap list for 1st Edition, Shadowless, Unlimited, Japanese No Rarity, holo/non-holo, promo stamps, and other historically meaningful printings where relevant.
9. Generate a deduplicated normalized catalog and validate every record against `catalog/card-record.schema.json`.

## Required deliverables

- `catalog/audit/raw/`: source snapshots and metadata.
- `catalog/audit/coverage.json`: counts and coverage by language.
- `catalog/audit/gaps.csv`: missing records, images and printing distinctions.
- `catalog/cards.json`: normalized records.
- `catalog/audit/README.md`: exact method, source dates and known limitations.

## Completion rule

The audit is not complete merely because the API returned successfully. It is complete only when the inventory is reproducible, the omissions are explicit, and every variant claim has provenance.
