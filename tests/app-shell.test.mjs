import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync("index.html", "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(scriptMatch, "index.html must contain the application script");
const script = scriptMatch[1];
const pipeline = fs.readFileSync("src/recognition-pipeline.mjs", "utf8");
const ocr = fs.readFileSync("src/ocr-adapter.mjs", "utf8");
const vision = fs.readFileSync("src/card-vision.js", "utf8");
const serviceWorker = fs.readFileSync("sw.js", "utf8");
const visual = fs.readFileSync("src/visual-match.mjs", "utf8");

test("application script parses without syntax errors", () => {
  assert.doesNotThrow(() => new vm.Script(script, { filename: "index.html inline script" }));
});

test("scanner has an explicit search action and does not silently choose Bulbasaur", () => {
  assert.match(script, /function runFreeMatch\(/);
  assert.match(script, /Bevestig de Pokémon/);
  assert.match(script, /Selecteer de Pokémon of vul een kaartnummer in/);
});

test("scanner searches the local catalog in both supported languages", () => {
  assert.match(script, /loadLanguage\('en'\)/);
  assert.match(script, /loadLanguage\('ja'\)/);
  assert.match(script, /import\('\.\/src\/catalog-loader\.mjs'\)/);
});

test("scanner uses local OpenCV and the bilingual recognition pipeline", () => {
  assert.match(html, /<script src="\.\/src\/card-vision\.js"><\/script>/);
  assert.match(script, /import\('\.\/src\/recognition-pipeline\.mjs'\)/);
  assert.match(pipeline, /language === "auto" \? \["en", "ja"\]/);
  assert.match(vision, /\.\.\/assets\/opencv\.js/);
});

test("OCR assets are loaded locally and no OCR CDN is used", () => {
  assert.match(ocr, /\.\.\/assets\/tesseract\.min\.js/);
  assert.match(ocr, /\.\.\/assets\/tessdata\//);
  assert.doesNotMatch(html, /cdn\.jsdelivr\.net\/npm\/tesseract/);
});

test("candidate choice retains the language and set/card identifiers", () => {
  assert.match(script, /scanChooseCard\(setId,cardId,lang='en'\)/);
  assert.match(script, /scanChooseCard\(\\'/);
  assert.match(script, /c\.pokemonNames/);
});

test("service worker caches same-origin scanner assets and catalog files", () => {
  assert.match(serviceWorker, /cache\.put\(request, response\.clone\(\)\)/);
  assert.match(serviceWorker, /url\.origin !== self\.location\.origin/);
  assert.match(serviceWorker, /Offline: dit onderdeel is nog niet lokaal opgeslagen/);
});

test("scanner registration resolves candidates from the local catalog without a network lookup", () => {
  assert.match(script, /async function chooseCard\(id,localCard=null\)/);
  assert.match(script, /const records=await window\.kanto151Catalog\.loadSet\(lang,setId\)/);
  assert.match(script, /await chooseCard\(cardId,localCard\)/);
});

test("registration preserves source printing identity and variant metadata", () => {
  assert.match(script, /printingId:selectedVariant\?\.id/);
  assert.match(script, /variantData:selectedVariant\?\.data/);
  assert.match(script, /window\.pendingCardVariants=sourceVariants\.map/);
});

test("manual retry keeps English and Japanese OCR names separate", () => {
  assert.match(script, /window\.scanNameTextByLanguage\?\.en/);
  assert.match(script, /window\.scanNameTextByLanguage\?\.ja/);
});

test("candidate list displays canonical species names alongside the source card name", () => {
  assert.match(script, /const speciesNames=/);
  assert.match(script, /Pokémon: /);
  assert.match(script, /c\.pokemonNames/);
});

test("scanner visually ranks English candidates without pretending Japanese images exist", () => {
  assert.match(script, /rankVisualCandidates/);
  assert.match(script, /candidate\.record\?\.images\?\.sourceBaseUrl/);
  assert.match(script, /Japanse bronafbeeldingen ontbreken grotendeels/);
  assert.match(pipeline, /visualCanvas: detection\.canvas/);
});

test("user-confirmed scans can save only local visual fingerprints", () => {
  assert.match(script, /id="savevisualref" type="checkbox" checked/);
  assert.match(script, /storeUserReference\(c\.recordId,variantId,window\.lastScanVisualCanvas\)/);
  assert.match(visual, /export async function storeUserReference/);
  assert.match(visual, /writeCachedFeature\(key, entries\.slice\(-8\)\)/);
  assert.doesNotMatch(visual, /localStorage/);
});

test("registration requires an explicit Pokémon choice when the source record is ambiguous", () => {
  assert.match(script, /Selecteer de juiste Pokémon/);
  assert.match(script, /Selecteer eerst de juiste Pokémon/);
});

test("locally learned visual references can rank Japanese cards on later scans", () => {
  assert.match(script, /hasUserReference\(candidate\.record\?\.recordId\)/);
  assert.match(visual, /export async function hasUserReference/);
  assert.match(visual, /visualSource: "personal"/);
});
