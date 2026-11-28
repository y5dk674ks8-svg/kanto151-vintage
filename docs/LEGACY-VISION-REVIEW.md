# Review of the preserved visual-scanner prototype

Reviewed source branch: `visual-card-matching-prototype`, 2026-11-28.

## Card localization

`card-vision.js` is a useful baseline:
- Loads OpenCV locally rather than depending on a cloud vision API.
- Uses multi-pass contour detection and geometric checks.
- Rejects unreliable sleeve contours rather than blindly accepting the largest quadrilateral.
- Perspective-corrects the card face.
- Produces a second higher-resolution perspective-corrected canvas for collector-number OCR.

Recommendation: port this detector into the new scanner behind a small adapter and regression-test it against the existing camera-photo examples before changing its thresholds. Keep its confidence as a detector-quality signal only; it is not a card-identity confidence.

## Visual matcher

`visual-match.js` is a useful baseline feature ranker:
- 64-bit DCT perceptual hash.
- 4×4 spatial tile hashes.
- HSV-style colour histogram.
- Separate footer hash to emphasize collector-number region.
- Separate artwork crop.
- Four inset query crops to tolerate clear-sleeve margins.
- Concurrent candidate comparison.

The combined score currently weights spatial tiles and footer strongly. This is a ranking score, not a calibrated probability. It has not yet been validated on a held-out benchmark.

## Required changes before reuse

1. Adapt its input from legacy `candidate.image` strings to normalized catalog records and per-printing image references.
2. Move cached reference features from unbounded `localStorage` JSON to versioned IndexedDB records.
3. Bound feature-cache size and support cache invalidation when catalog/image hashes change.
4. Return independent feature components and diagnostic evidence, not just one opaque score.
5. Add explicit image-orientation, glare, sleeve, crop, and lighting test cases.
6. Evaluate near-identical reprints and variants separately. The footer helps only when the collector-number region is readable.
7. Keep the OCR and visual scores independent until a labelled test set can support a calibrated fusion rule.

## Japanese image limitation

The TCGdex seed catalog currently has no image URL for the 786 Japanese Kanto card records in scope. The old visual matcher cannot identify those cards visually without a permitted reference image. Do not silently substitute English scans or download third-party scans without permission. See [IMAGE-AND-SOURCE-AUDIT.md](IMAGE-AND-SOURCE-AUDIT.md).

## Current implementation

- The OpenCV detector has been copied into `src/card-vision.js` and is loaded from the locally vendored OpenCV runtime.
- The visual feature ranker has been ported into `src/visual-match.mjs`.
- The new ranker caches derived feature descriptors in IndexedDB rather than serializing an ever-growing object to localStorage.
- The scanner applies visual ranking only to English candidates with a TCGdex reference image.
- Japanese candidates remain text-ranked because the current seed catalog has no Japanese reference images.
- The raw user photo remains local; only public reference images are downloaded for client-side comparison.

## Decision

Use OCR and visual similarity as independent candidate-ranking signals. Visual scores are not probabilities and are never used for automatic confirmation. The current matcher has unit tests for its perceptual-hash and descriptor-ranking math, but it still needs a labelled benchmark with sleeve, glare, angle, lighting and near-identical reprint cases before its weights can be tuned or trusted.
