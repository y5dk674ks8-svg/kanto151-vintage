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
  assert.deepEqual(coverage.validation.recordsWithDuplicatePrintingIds, []);
  assert.equal(coverage.validation.recordsWithNoKantoDexId, 0);
  assert.equal(coverage.validation.recordsWithNoPrintingEntry, 0);
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
  assert.ok(coverage.externalJapaneseSetReference.sourceCountDiffers.length > 0);
});
