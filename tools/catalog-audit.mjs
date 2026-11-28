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
      gaps.push({ language, type: "set-fetch-failed", setId: brief.id, detail: String(error) });
      return null;
    }
  });

  const inScope = [];
  const unknownDate = [];
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
        if (card.category === "Pokemon") {
          gaps.push({ language, type: "pokemon-card-without-kanto-dex-id-or-out-of-scope", setId: set.id, cardId: card.id, cardName: card.name });
        }
        continue;
      }

      includedInSet++;
      kantoCardCount++;
      const imageBase = card.image || null;
      if (!imageBase) {
        missingImageCount++;
        gaps.push({ language, type: "missing-image", setId: set.id, cardId: card.id, cardName: card.name });
      }
      const variants = card.variants ?? null;
      const detailedVariants = card.variants_detailed ?? null;
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
        printings: [{
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

  coverage.languages[language] = {
    totalSetsInSourceIndex: allSets.length,
    setsInDateScope: inScope.length,
    setsWithUnknownDate: unknownDate.length,
    sourceCardsInDateScopeSets: setCardCount,
    kantoCardRecords: kantoCardCount,
    kantoRecordsMissingImage: missingImageCount,
    selectedSets: selectedSetSummaries
  };
  console.log(`[${language}] Done: ${inScope.length} sets, ${kantoCardCount} Kanto card records`);
}

normalized.sort((a, b) =>
  a.language.localeCompare(b.language) ||
  String(a.set.releaseDate).localeCompare(String(b.set.releaseDate)) ||
  a.set.setId.localeCompare(b.set.setId) ||
  a.collectorNumber.raw.localeCompare(b.collectorNumber.raw, undefined, { numeric: true })
);

coverage.totalNormalizedRecords = normalized.length;
coverage.uniqueKantoDexIds = [...new Set(normalized.flatMap(card => card.pokemonDexIds))].sort((a, b) => a - b);
coverage.missingKantoDexIds = Array.from({ length: 151 }, (_, i) => i + 1).filter(id => !coverage.uniqueKantoDexIds.includes(id));
coverage.gapCount = gaps.length;

await fs.writeFile(path.join(OUT, "cards.json"), JSON.stringify(normalized, null, 2));
await fs.writeFile(path.join(OUT, "audit", "coverage.json"), JSON.stringify(coverage, null, 2));
const columns = ["language", "type", "setId", "setName", "cardId", "cardName", "detail"];
const csv = [columns.join(","), ...gaps.map(g => columns.map(key => csvCell(g[key] ?? "")).join(","))].join("\n");
await fs.writeFile(path.join(OUT, "audit", "gaps.csv"), csv);
await fs.writeFile(path.join(OUT, "audit", "README.md"),
  `# Generated catalog audit\n\nRetrieved: ${retrievedAt}\n\nSource: TCGdex REST API v2.\n\nRecords: ${normalized.length}.\n\nUnique Kanto dex IDs: ${coverage.uniqueKantoDexIds.length}/151.\n\nGap entries: ${gaps.length}.\n\nThis report is a source-coverage audit, not a claim that every historical physical printing or variant is represented. See [CATALOG-AUDIT.md](../../docs/CATALOG-AUDIT.md) for methodology and limitations.\n`);
console.log(`Audit complete: ${normalized.length} records; ${gaps.length} gaps.`);
