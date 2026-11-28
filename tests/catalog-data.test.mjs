import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const coverage = JSON.parse(fs.readFileSync("catalog/audit/coverage.json", "utf8"));
const readSet = (language, setId) => JSON.parse(
  fs.readFileSync(`catalog/cards/${language}/${setId}.json`, "utf8")
);

test("generated catalog covers all 151 Kanto dex IDs in both languages", () => {
  assert.equal(coverage.languages.en.uniqueKantoDexIds.length, 151);
  assert.equal(coverage.languages.ja.uniqueKantoDexIds.length, 151);
  assert.deepEqual(coverage.languages.en.missingKantoDexIds, []);
  assert.deepEqual(coverage.languages.ja.missingKantoDexIds, []);
});

test("generated record and printing identities are unique", () => {
  assert.equal(coverage.validation.duplicateRecordIds, 0);
  assert.ok(coverage.validation.duplicateSourceVariantEntriesRemoved > 0);
  assert.deepEqual(coverage.validation.recordsWithDuplicatePrintingIds, []);
  assert.equal(coverage.validation.recordsWithNoKantoDexId, 0);
  assert.equal(coverage.validation.recordsWithNoPrintingEntry, 0);
  assert.equal(coverage.validation.recordsWithNoPokemonNameAlias, 0);
  assert.equal(coverage.pokemonNameReference.entries, 151);
  assert.equal(coverage.validation.firstEditionStampMismatches, 0);
  assert.equal(coverage.validation.unlimitedMisclassified, 0);
  assert.equal(coverage.validation.noRarityMisclassified, 0);
});

test("variant mapping does not leak first-edition status to Unlimited printings", () => {
  const alakazam = readSet("en", "base1").find(card => card.recordId === "en:base1-1");
  assert.ok(alakazam);
  const unlimited = alakazam.printings.filter(p => p.sourceDetailedVariants?.subtype === "unlimited");
  const firstEdition = alakazam.printings.filter(p =>
    p.sourceDetailedVariants?.stamp?.some(stamp => /1st[ -]?edition/i.test(stamp))
  );
  assert.ok(unlimited.length > 0);
  assert.ok(firstEdition.length > 0);
  assert.ok(unlimited.every(p => p.variant.edition === "Unlimited"));
  assert.ok(firstEdition.every(p => p.variant.edition === "1st Edition"));
});

test("Japanese No Rarity printing is preserved as its own variant", () => {
  const bulbasaur = readSet("ja", "PMCG1").find(card => card.recordId === "ja:PMCG1-001");
  assert.ok(bulbasaur);
  assert.ok(bulbasaur.printings.some(p =>
    p.sourceDetailedVariants?.subtype === "no-rarity" && p.variant.edition === "No Rarity"
  ));
});

test("catalog audit reports the Japanese vintage reference omissions and count conflicts", () => {
  assert.equal(coverage.externalJapaneseSetReference.referenceSetGroups, 27);
  assert.ok(coverage.externalJapaneseSetReference.missingFromTcgdexSetAudit.length > 0);
  assert.equal(coverage.externalJapaneseSetReference.additionalDistinctGroups, 5);
  assert.equal(coverage.externalJapaneseSetReference.overlapsCoreVintageGroups, 7);
  assert.ok(coverage.externalJapaneseSetReference.sourceCountDiffers.length > 0);
  assert.equal(coverage.gapTypes["set-fetch-failed"], undefined);
  assert.equal(coverage.gapTypes["card-fetch-failed"], undefined);
  assert.ok(Array.isArray(coverage.sourceFetchWarnings));
  assert.equal(coverage.sourceFetchWarningCount, coverage.sourceFetchWarnings.length);
});

test("Japanese Vending Series 1–3 supplemental Kanto records are included and explicitly unverified", () => {
  assert.equal(coverage.languages.ja.supplementalKantoCardRecords, 100);
  assert.equal(coverage.languages.ja.combinedCatalogKantoCardRecords, 886);
  assert.equal(coverage.supplementalJapaneseSets.length, 3);
  const index = JSON.parse(fs.readFileSync("catalog/index.json", "utf8"));
  const indexRecordCount = [...index.languages.en, ...index.languages.ja].reduce((sum, set) => sum + set.recordCount, 0);
  assert.equal(coverage.totalNormalizedRecords, indexRecordCount);
  const printings = [...index.languages.en, ...index.languages.ja].reduce((sum, set) => {
    const records = readSet(set.language || (index.languages.en.includes(set) ? "en" : "ja"), set.setId);
    return sum + records.reduce((n, card) => n + card.printings.length, 0);
  }, 0);
  assert.equal(coverage.totalSourceVariantEntries, printings);
  assert.equal(coverage.externalJapaneseSetReference.supplementalSeededGroups.length, 3);
  assert.equal(coverage.externalJapaneseSetReference.remainingUnseededGroups.length, 7);
  for (const setId of ["vending1", "vending2", "vending3", "neo-premium-file-2", "cd-promo-1999", "southern-islands", "unnumbered-promos-1998"]) {
    const records = readSet("ja", setId);
    assert.ok(records.length > 0);
    assert.ok(records.every(card =>
      card.language === "ja" &&
      card.pokemonNames.length > 0 &&
      card.collectorNumber.raw === null &&
      card.source.provider === "japanesepokemoncards.net" &&
      card.printings.every(printing => printing.verificationStatus === "unverified")
    ));
  }
});

test("supplemental promo seed preserves year precision and the CD Promo count discrepancy", () => {
  const cd = coverage.supplementalJapaneseSets.find(set => set.setId === "cd-promo-1999");
  const neo = coverage.supplementalJapaneseSets.find(set => set.setId === "neo-premium-file-2");
  const south = coverage.supplementalJapaneseSets.find(set => set.setId === "southern-islands");
  assert.equal(cd.totalCardsInSource, 10);
  assert.equal(cd.listedCardsInSource, 11);
  assert.equal(cd.referenceGroupName, "CD Promo");
  assert.equal(neo.releaseDatePrecision, "year");
  assert.equal(south.releaseDatePrecision, "month");
});
