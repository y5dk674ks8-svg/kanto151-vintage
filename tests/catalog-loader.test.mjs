import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCardText,
  normalizeCollectorNumber,
  textSimilarity,
  rankCatalogCandidates,
  KantoCatalog
} from "../src/catalog-loader.mjs";

test("normalizes Latin and Japanese card names without destroying Japanese text", () => {
  assert.equal(normalizeCardText("Mr. Mime"), "mrmime");
  assert.equal(normalizeCardText("Pokémon"), "pokemon");
  assert.equal(normalizeCardText("フシギダネ"), "フシギダネ");
  assert.equal(normalizeCardText("フシギダネ"), normalizeCardText("フシギダネ"));
});

test("normalizes collector numbers but preserves non-numeric identifiers", () => {
  assert.equal(normalizeCollectorNumber(" 004 / 102 "), "4");
  assert.equal(normalizeCollectorNumber("TG01"), "tg01");
});

test("calculates useful fuzzy name similarity", () => {
  assert.equal(textSimilarity("Pikachu", "Pikachu"), 1);
  assert.ok(textSimilarity("Pikachu", "Pikach") > 0.8);
});

test("ranks matching dex id and collector number above weaker candidates", () => {
  const records = [
    { recordId: "a", pokemonDexIds: [25], collectorNumber: { raw: "58" }, cardIdentity: { name: "Pikachu" }, set: { name: "Base Set", setId: "base1" } },
    { recordId: "b", pokemonDexIds: [25], collectorNumber: { raw: "4" }, cardIdentity: { name: "Pikachu" }, set: { name: "Jungle", setId: "base2" } },
    { recordId: "c", pokemonDexIds: [26], collectorNumber: { raw: "4" }, cardIdentity: { name: "Raichu" }, set: { name: "Base Set", setId: "base1" } }
  ];
  const ranked = rankCatalogCandidates(records, { dexId: 25, collectorNumber: "4/102", name: "Pikachu" });
  assert.equal(ranked[0].record.recordId, "b");
  assert.ok(ranked[0].score > ranked[1].score);
  assert.ok(ranked[0].evidence.includes("Pokédexnummer komt overeen"));
});

test("loads each set once and searches a local language catalog", async () => {
  const payloads = {
    "./catalog/index.json": { languages: { en: [{ setId: "base1", path: "cards/en/base1.json" }] } },
    "./catalog/cards/en/base1.json": [
      { recordId: "en:base1-58", pokemonDexIds: [25], collectorNumber: { raw: "58" }, cardIdentity: { name: "Pikachu" }, set: { name: "Base Set", setId: "base1" } }
    ]
  };
  const calls = [];
  const fetchImpl = async url => {
    calls.push(url);
    return { ok: true, json: async () => payloads[url] };
  };
  const catalog = new KantoCatalog({ fetchImpl });
  const first = await catalog.search("en", { name: "Pikachu", dexId: 25 });
  const second = await catalog.search("en", { name: "Pikachu", dexId: 25 });
  assert.equal(first[0].record.recordId, "en:base1-58");
  assert.equal(second.length, 1);
  assert.equal(calls.filter(url => url.endsWith("base1.json")).length, 1);
});
