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
- [ ] Audit all source sets, cards, languages, images and variant metadata.
- [ ] Build a normalized local catalog.
- [ ] Build deterministic candidate retrieval.
- [ ] Add OCR and visual ranking as independent signals.
- [ ] Establish a labeled test set and measure precision/recall.
- [ ] Integrate camera and upload flows.
