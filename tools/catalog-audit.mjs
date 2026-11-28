import fs from "node:fs/promises";
import path from "node:path";

const LANGUAGES = ["en", "ja"];
const START = "1996-01-01";
const END = "2002-12-31";
const BASE = "https://api.tcgdex.net/v2";
const OUT = "catalog";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function requestJson(url, attempts = 5) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Kanto151-Catalog-Audit/1.0", "Accept": "application/json" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await sleep(400 * (2 ** attempt));
    }
  }
  throw lastError;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function dateInScope(date) {
  return typeof date === "string" && date >= START && date <= END;
}
function safeId(value) {
  return String(value ?? "").replaceAll("/", "_").replaceAll("..", "_");
}
function csvCell(value) {
  return '"' + String(value ?? "").replaceAll('"', '""') + '"';
}

await fs.mkdir(path.join(OUT, "audit", "raw"), { recursive: true });
const pokemonNameReference = JSON.parse(await fs.readFile(path.join(OUT, "pokemon-name-reference.json"), "utf8"));
const pokemonNamesByDex = new Map(pokemonNameReference.entries.map(entry => [entry.dexId, entry]));
const retrievedAt = new Date().toISOString();
const normalized = [];
const coverage = {
  retrievedAt,
  source: "TCGdex REST API v2",
  scope: { languages: LANGUAGES, releaseDateStart: START, releaseDateEnd: END, kantoDexIds: [1, 151] },
  languages: {},
  knownLimitations: [
    "TCGdex language catalogs have different completion levels.",
    "TCGdex card-level variant fields do not guarantee complete historical printing coverage.",
    "A missing image or variant is recorded as a gap; it is not inferred."
  ]
};
const gaps = [];
const sourceFetchWarnings = [];
let duplicateSourceVariantEntriesRemoved = 0;

for (const language of LANGUAGES) {
  console.log(`[${language}] Fetching complete set index`);
  const setIndexUrl = `${BASE}/${language}/sets`;
  const allSets = await requestJson(setIndexUrl);
  await fs.writeFile(path.join(OUT, "audit", "raw", `${language}-sets.json`), JSON.stringify(allSets, null, 2));

  const setDetails = await mapLimit(allSets, 4, async brief => {
    try {
      const detail = await requestJson(`${BASE}/${language}/sets/${encodeURIComponent(brief.id)}`);
      return detail;
    } catch (error) {
      sourceFetchWarnings.push({ language, setId: brief.id, setName: brief.name, detail: String(error) });
      return null;
    }
  });

  await fs.writeFile(path.join(OUT, "audit", "raw", `${language}-set-details.json`), JSON.stringify(setDetails, null, 2));
  const inScope = [];
  const unknownDate = [];
  const rawKantoCards = [];
  for (const set of setDetails.filter(Boolean)) {
    if (dateInScope(set.releaseDate)) inScope.push(set);
    else if (!set.releaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(set.releaseDate)) {
      unknownDate.push(set);
      gaps.push({ language, type: "set-date-unknown", setId: set.id, setName: set.name, detail: set.releaseDate ?? "" });
    }
  }

  let setCardCount = 0;
  let kantoCardCount = 0;
  let missingImageCount = 0;
  let nonKantoPokemonCount = 0;
  const selectedSetSummaries = [];

  for (const set of inScope) {
    const briefs = set.cards || [];
    setCardCount += briefs.length;
    console.log(`[${language}] ${set.name}: inspecting ${briefs.length} cards`);
    const details = await mapLimit(briefs, 5, async brief => {
      try {
        return await requestJson(`${BASE}/${language}/cards/${encodeURIComponent(brief.id)}`);
      } catch (error) {
        gaps.push({ language, type: "card-fetch-failed", setId: set.id, cardId: brief.id, detail: String(error) });
        return null;
      }
    });

    let includedInSet = 0;
    for (const card of details.filter(Boolean)) {
      const dexIds = Array.isArray(card.dexId)
        ? [...new Set(card.dexId.filter(id => Number.isInteger(id) && id >= 1 && id <= 151))]
        : [];
      if (!dexIds.length) {
        if (card.category === "Pokemon") nonKantoPokemonCount++;
        continue;
      }

      includedInSet++;
      kantoCardCount++;
      rawKantoCards.push(card);
      const imageBase = card.image || null;
      if (!imageBase) {
        missingImageCount++;
        gaps.push({ language, type: "missing-image", setId: set.id, cardId: card.id, cardName: card.name });
      }
      const variants = card.variants ?? null;
      const detailedVariants = card.variants_detailed ?? (Array.isArray(variants) ? variants : null);
      const rawVariantArray = Array.isArray(variants) ? variants : (Array.isArray(detailedVariants) ? detailedVariants : []);
      const variantArray = rawVariantArray.filter((variant, index, all) =>
        all.findIndex(candidate => JSON.stringify(candidate) === JSON.stringify(variant)) === index
      );
      duplicateSourceVariantEntriesRemoved += rawVariantArray.length - variantArray.length;
      const hasFirstEdition = Array.isArray(variants)
        ? variants.some(v => Array.isArray(v.stamp) && v.stamp.some(stamp => /1st[ -]?edition/i.test(stamp)))
        : variants?.firstEdition === true;
      const hasHolo = Array.isArray(variants)
        ? variants.some(v => v.type === "holo")
        : variants?.holo === true;
      const hasNormal = Array.isArray(variants)
        ? variants.some(v => v.type === "normal")
        : variants?.normal === true;
      const hasShadowless = variantArray.some(v => v.subtype === "shadowless");
      if (!variants && !detailedVariants) {
        gaps.push({ language, type: "variant-data-absent", setId: set.id, cardId: card.id, cardName: card.name });
      }

      normalized.push({
        recordId: `${language}:${card.id}`,
        language,
        source: {
          provider: "TCGdex",
          sourceCardId: card.id,
          sourceUrl: `${BASE}/${language}/cards/${encodeURIComponent(card.id)}`,
          retrievedAt
        },
        cardIdentity: {
          name: card.name ?? "",
          category: card.category ?? "unknown",
          illustrator: card.illustrator ?? null,
          rarity: card.rarity ?? null
        },
        pokemonDexIds: dexIds,
        pokemonNames: dexIds.map(dexId => {
          const names = pokemonNamesByDex.get(dexId);
          return names ? { dexId, en: names.en, ja: names.ja } : null;
        }).filter(Boolean),
        set: {
          setId: set.id,
          name: set.name,
          releaseDate: set.releaseDate ?? null,
          series: set.serie?.name ?? null,
          isPromo: /promo/i.test(String(set.name ?? "") + " " + String(set.id ?? ""))
        },
        collectorNumber: {
          raw: String(card.localId ?? ""),
          normalized: null,
          total: null
        },
        images: {
          sourceBaseUrl: imageBase,
          lowUrl: imageBase ? imageBase + "/low.webp" : null,
          highUrl: imageBase ? imageBase + "/high.webp" : null,
          localPath: null,
          sha256: null,
          available: Boolean(imageBase)
        },
        printings: variantArray.length ? variantArray.map((v, index) => ({
          printingId: `${language}:${card.id}:${v.variantId ?? index + 1}`,
          variant: {
            edition: (Array.isArray(v.stamp) && v.stamp.some(stamp => /1st[ -]?edition/i.test(stamp))) ? "1st Edition" : (v.subtype === "unlimited" ? "Unlimited" : (v.subtype === "no-rarity" ? "No Rarity" : null)),
            shadowless: v.subtype === "shadowless" ? true : null,
            finish: v.type === "holo" ? "holo" : v.type === "reverse" ? "reverse" : v.type === "normal" ? "normal" : (hasHolo ? "holo" : hasNormal ? "normal" : null),
            promoStamp: Array.isArray(v.stamp) ? v.stamp.filter(stamp => !/1st[ -]?edition/i.test(stamp)).join("; ") || null : null,
            other: v.subtype && !["shadowless", "unlimited", "no-rarity"].includes(v.subtype) ? v.subtype : null
          },
          sourceVariants: variants,
          sourceDetailedVariants: v,
          verificationStatus: "unverified",
          evidence: [{ kind: "source-record", description: "Imported from TCGdex detailed variant data; physical printing identity has not yet been manually verified.", url: `${BASE}/${language}/cards/${encodeURIComponent(card.id)}` }]
        })) : [{
          printingId: `${language}:${card.id}:source`,
          variant: {
            edition: variants?.firstEdition === true ? "1st Edition" : variants?.firstEdition === false ? "not-marked-first-edition" : null,
            shadowless: null,
            finish: variants?.holo ? "holo" : variants?.normal ? "normal-or-unspecified" : null,
            promoStamp: null,
            other: null
          },
          sourceVariants: variants,
          sourceDetailedVariants: detailedVariants,
          verificationStatus: "unverified",
          evidence: [{ kind: "source-record", description: "Imported from TCGdex; physical printing identity has not yet been manually verified.", url: `${BASE}/${language}/cards/${encodeURIComponent(card.id)}` }]
        }],
        audit: {
          recordStatus: imageBase ? "needs-review" : "missing-image",
          issues: [
            "TCGdex record is a seed record, not proof of complete physical-printing coverage.",
            "Verify exact printing/variant before treating it as a unique physical printing."
          ]
        }
      });
    }

    selectedSetSummaries.push({
      setId: set.id,
      name: set.name,
      releaseDate: set.releaseDate,
      sourceCardCount: briefs.length,
      kantoCardCount: includedInSet,
      promoByNameHeuristic: /promo/i.test(String(set.name ?? "") + " " + String(set.id ?? ""))
    });
  }

  await fs.writeFile(path.join(OUT, "audit", "raw", `${language}-kanto-card-details.json`), JSON.stringify(rawKantoCards, null, 2));
  coverage.languages[language] = {
    totalSetsInSourceIndex: allSets.length,
    setsInDateScope: inScope.length,
    setsWithUnknownDate: unknownDate.length,
    sourceCardsInDateScopeSets: setCardCount,
    kantoCardRecords: kantoCardCount,
    kantoRecordsMissingImage: missingImageCount,
    nonKantoPokemonRecordsInDateScopeSets: nonKantoPokemonCount,
    selectedSets: selectedSetSummaries,
    uniqueKantoDexIds: [...new Set(normalized.filter(card => card.language === language).flatMap(card => card.pokemonDexIds))].sort((a, b) => a - b)
  };
  coverage.languages[language].missingKantoDexIds = Array.from({ length: 151 }, (_, i) => i + 1).filter(id => !coverage.languages[language].uniqueKantoDexIds.includes(id));
  console.log(`[${language}] Done: ${inScope.length} sets, ${kantoCardCount} Kanto card records`);
}

normalized.sort((a, b) =>
  a.language.localeCompare(b.language) ||
  String(a.set.releaseDate).localeCompare(String(b.set.releaseDate)) ||
  a.set.setId.localeCompare(b.set.setId) ||
  a.collectorNumber.raw.localeCompare(b.collectorNumber.raw, undefined, { numeric: true })
);

coverage.totalNormalizedRecords = normalized.length;
coverage.totalSourceVariantEntries = normalized.reduce((sum, card) => sum + card.printings.length, 0);
for (const language of LANGUAGES) {
  const languageCards = normalized.filter(card => card.language === language);
  coverage.languages[language].sourceVariantEntries = languageCards.reduce((sum, card) => sum + card.printings.length, 0);
}
coverage.uniqueKantoDexIds = [...new Set(normalized.flatMap(card => card.pokemonDexIds))].sort((a, b) => a - b);
coverage.missingKantoDexIds = Array.from({ length: 151 }, (_, i) => i + 1).filter(id => !coverage.uniqueKantoDexIds.includes(id));
coverage.sourceFetchWarnings = sourceFetchWarnings;
coverage.gapCount = gaps.length;
coverage.gapTypes = gaps.reduce((counts, gap) => {
  counts[gap.type] = (counts[gap.type] || 0) + 1;
  return counts;
}, {});
const japaneseReference = JSON.parse(await fs.readFile(path.join(OUT, "audit", "japanese-vintage-set-reference.json"), "utf8"));
const japaneseActualSets = new Map(coverage.languages.ja.selectedSets.map(set => [set.setId, set]));
const referenceGroups = japaneseReference.coreVintageGroups;
const referenceMissing = referenceGroups.filter(set => !set.tcgdexSetId || !japaneseActualSets.has(set.tcgdexSetId));
const referenceCountDiffers = referenceGroups.filter(set => {
  const actual = set.tcgdexSetId ? japaneseActualSets.get(set.tcgdexSetId) : null;
  return actual && actual.sourceCardCount !== set.counts.vintageChecklist;
});
coverage.externalJapaneseSetReference = {
  sources: japaneseReference.sources,
  referenceSetGroups: referenceGroups.length,
  supplementaryPromotionalAndDeckReferences: japaneseReference.additionalPromotionalAndDeckGroups.length,
  additionalDistinctGroups: japaneseReference.additionalPromotionalAndDeckGroups.filter(group => !group.overlapsCoreVintageGroup).length,
  overlapsCoreVintageGroups: japaneseReference.additionalPromotionalAndDeckGroups.filter(group => group.overlapsCoreVintageGroup).length,
  presentInTcgdexSetAudit: referenceGroups.length - referenceMissing.length,
  missingFromTcgdexSetAudit: referenceMissing.map(set => ({
    name: set.englishName, japaneseName: set.japaneseName, year: set.year,
    vintageChecklistCount: set.counts.vintageChecklist, tcgdexSetId: set.tcgdexSetId
  })),
  sourceCountDiffers: referenceCountDiffers.map(set => ({
    name: set.englishName,
    tcgdexSetId: set.tcgdexSetId,
    vintageChecklistCount: set.counts.vintageChecklist,
    tcgdexSourceSetCount: japaneseActualSets.get(set.tcgdexSetId).sourceCardCount,
    independentTcgdexIndexCount: set.counts.tcgdexSourceSet
  })),
  caveats: japaneseReference.caveats
};
const recordIds = normalized.map(card => card.recordId);
const duplicatePrintingIds = normalized.flatMap(card => {
  const ids = card.printings.map(printing => printing.printingId);
  return ids.length - new Set(ids).size ? [card.recordId] : [];
});
const japaneseNameAliasGaps = normalized.filter(card =>
  card.language === "ja" &&
  card.cardIdentity.category === "Pokemon" &&
  !card.pokemonNames.some(names => {
    const sourceName = String(card.cardIdentity.name ?? "").normalize("NFC");
    return sourceName.includes(names.ja) || sourceName.toLocaleLowerCase().includes(names.en.toLocaleLowerCase());
  })
).map(card => card.recordId);
const allPrintings = normalized.flatMap(card => card.printings);
const firstEditionStampMismatches = allPrintings.filter(printing =>
  Array.isArray(printing.sourceDetailedVariants?.stamp) &&
  printing.sourceDetailedVariants.stamp.some(stamp => /1st[ -]?edition/i.test(stamp)) &&
  printing.variant.edition !== "1st Edition"
).length;
const unlimitedMisclassified = allPrintings.filter(printing =>
  printing.sourceDetailedVariants?.subtype === "unlimited" &&
  printing.variant.edition !== "Unlimited"
).length;
const noRarityMisclassified = allPrintings.filter(printing =>
  printing.sourceDetailedVariants?.subtype === "no-rarity" &&
  printing.variant.edition !== "No Rarity"
).length;
coverage.validation = {
  recordCount: normalized.length,
  duplicateSourceVariantEntriesRemoved,
  uniqueRecordIds: new Set(recordIds).size,
  duplicateRecordIds: recordIds.length - new Set(recordIds).size,
  recordsWithNoKantoDexId: normalized.filter(card => !card.pokemonDexIds.length).length,
  recordsWithNoPrintingEntry: normalized.filter(card => !card.printings.length).length,
  recordsWithNoPokemonNameAlias: normalized.filter(card => !card.pokemonNames.length).length,
  japanesePokemonNameAliasGapCount: japaneseNameAliasGaps.length,
  japanesePokemonNamesWithoutCanonicalSpeciesMatch: japaneseNameAliasGaps,
  printingEntryCount: allPrintings.length,
  recordsWithDuplicatePrintingIds: duplicatePrintingIds,
  firstEditionStampMismatches,
  unlimitedMisclassified,
  noRarityMisclassified,
  allKantoDexIdsRepresented: coverage.missingKantoDexIds.length === 0
};
coverage.pokemonNameReference = {
  source: pokemonNameReference.source,
  sourceUrl: pokemonNameReference.sourceUrl,
  sourceCommit: pokemonNameReference.sourceCommit,
  entries: pokemonNameReference.entries.length,
  scope: pokemonNameReference.scope
};
for (const recordId of japaneseNameAliasGaps) {
  const card = normalized.find(item => item.recordId === recordId);
  gaps.push({
    language: "ja",
    type: "card-name-does-not-contain-canonical-pokemon-name",
    setId: card?.set.setId,
    cardId: card?.source.sourceCardId,
    cardName: card?.cardIdentity.name,
    canonicalPokemonNames: card?.pokemonNames.map(names => names.ja).join("; ")
  });
}
coverage.gapCount = gaps.length;
coverage.gapTypes = gaps.reduce((counts, gap) => {
  counts[gap.type] = (counts[gap.type] || 0) + 1;
  return counts;
}, {});

const setGroups = new Map();
for (const card of normalized) {
  const key = `${card.language}/${safeId(card.set.setId)}`;
  if (!setGroups.has(key)) setGroups.set(key, []);
  setGroups.get(key).push(card);
}
const catalogIndex = {
  generatedAt: retrievedAt,
  schema: "../card-record.schema.json",
  languages: {}
};
for (const language of LANGUAGES) {
  catalogIndex.languages[language] = [];
  const prefix = path.join(OUT, "cards", language);
  await fs.mkdir(prefix, { recursive: true });
}
for (const [key, records] of setGroups) {
  const [language, setId] = key.split("/");
  const relativePath = `cards/${language}/${setId}.json`;
  await fs.writeFile(path.join(OUT, relativePath), JSON.stringify(records));
  catalogIndex.languages[language].push({
    setId: records[0].set.setId,
    setName: records[0].set.name,
    releaseDate: records[0].set.releaseDate,
    recordCount: records.length,
    path: relativePath
  });
}
for (const language of LANGUAGES) {
  catalogIndex.languages[language].sort((a, b) => String(a.releaseDate).localeCompare(String(b.releaseDate)));
}
await fs.writeFile(path.join(OUT, "index.json"), JSON.stringify(catalogIndex, null, 2));
await fs.writeFile(path.join(OUT, "audit", "coverage.json"), JSON.stringify(coverage, null, 2));
const columns = ["language", "type", "setId", "setName", "cardId", "cardName", "canonicalPokemonNames", "detail"];
const csv = [columns.join(","), ...gaps.map(g => columns.map(key => csvCell(g[key] ?? "")).join(","))].join("\n");
await fs.writeFile(path.join(OUT, "audit", "gaps.csv"), csv);
await fs.writeFile(path.join(OUT, "audit", "README.md"),
  `# Generated catalog audit\n\nRetrieved: ${retrievedAt}\n\nSource: TCGdex REST API v2.\n\nRecords: ${normalized.length}.\n\nUnique Kanto dex IDs: ${coverage.uniqueKantoDexIds.length}/151.\n\nGap entries: ${gaps.length}.\n\nThis report is a source-coverage audit, not a claim that every historical physical printing or variant is represented. See [CATALOG-AUDIT.md](../../docs/CATALOG-AUDIT.md) for methodology and limitations.\n`);
console.log(`Audit complete: ${normalized.length} records; ${gaps.length} gaps.`);
