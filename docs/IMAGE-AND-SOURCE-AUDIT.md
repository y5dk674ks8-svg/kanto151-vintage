# Image and catalog source evaluation

Research snapshot: 2026-11-28.

## Findings

### TCGdex is a useful seed, not a complete vintage Japanese catalog

The current TCGdex API audit returned 17 Japanese set records within 1996–2002 and 786 Kanto card records. A separate independent Japanese vintage checklist describes 27 groups and 1,777 cards for 1996–2002, including Gym decks, Neo Premium Files, Vending sheets, CD promos, Southern Islands and unnumbered promos. The set-by-set discovery list is stored in `japanese-vintage-set-reference.json`.

The independent checklist is secondary evidence. Its counts and labels must be reconciled with original product checklists before being treated as canonical.

### Japanese image gap

In the current TCGdex snapshot:
- English Kanto card records: 882; records without an image: 7.
- Japanese Kanto card records: 786; records without an image: 786.

This does not mean Japanese images do not exist. It means the current TCGdex card records in this snapshot did not expose an image URL.

### Candidate Japanese image and metadata sources

1. **Japanese Card Encyclopedia & Deck Builder (2005 CD-ROM)** — research indicates a preserved official database covering Japanese cards from the first set through PCG, with roughly 3,688 card entries and 3,647 small 162×226 images. This is valuable for cross-checking Japanese card names, set codes, numbers, illustrator and holo data. Image resolution is too low to be the only visual reference. Rights and reuse terms require review.
2. **pcg-search.com** — research indicates a large set of clean 593×834 scans for Japanese cards from 1996–2006 and a high match rate against Japanese TCGdex records. The site does not publish clear reuse terms in the research snapshot. Do not mirror, bulk-download or redistribute these images without permission.
3. **Bulbagarden Archives / 52poke / TCG Collector / Pokellector** — possible reference sources, but the research notes mixed image provenance, user scans, watermarks, and/or terms restricting reuse. Do not treat these as freely reusable assets.
4. **User-supplied scans** — preferred for any card where a source image cannot be legally reused. Store user-provided references locally with consent and provenance.

Research lead: PTCG Image Atlas, snapshot September 2026:
https://nstrelow.github.io/ptcg-image-atlas/
Its author explicitly says the source comparisons are research notes and not hand-verified; treat source matches as leads, not definitive licensing or provenance.

Other discovery reference:
https://japanesepokemoncards.net/vintage

TCGdex status page:
https://tcgdex.dev/status

## Local visual references and privacy

The scanner can optionally store a compact visual feature descriptor after the user confirms a card and its printing. This is an explicit opt-in. The original camera photo is not stored; only derived visual features and the selected catalog/printing IDs are written to local IndexedDB on the device. These user references can help rank later scans, including Japanese cards for which TCGdex has no reference images. They are not uploaded or synchronized by this scanner.

## Implementation policy

- Never silently substitute an English card image for a Japanese printing.
- Never infer No Rarity, 1st Edition, Unlimited, Shadowless, holo or promo stamp from a card name alone.
- Keep card identity and physical printing identity separate.
- Preserve source URLs, retrieval date, image hash and rights/provenance notes for every image.
- Do not bulk mirror third-party card scans until permission/licence is confirmed.
- Treat remote TCGdex reference images as experimental ranking inputs only; their upstream image rights are not established by the TCGdex card-data licence.
- Keep the user's visual-reference feature opt-in and store only local descriptors, never the raw camera photo.
- Build recognition support for Japanese cards in two stages: metadata and candidate retrieval first; image-based matching only where a permitted reference image or user-supplied scan exists.
- Keep image availability separate from catalog-record availability in all UI and metrics.

## Next audit tasks

- Reconcile all 27 Japanese vintage set groups in the reference manifest against primary checklists and TCGdex.
- Add missing Japanese deck, vending, premium-file and promo records with provenance.
- Compare Japanese official CD-ROM card list with TCGdex record IDs and identify exact omissions.
- Investigate the 7 missing English images.
- Create an image-source permission register before adding any third-party image host to the scanner.
