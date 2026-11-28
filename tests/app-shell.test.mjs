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
});

test("service worker caches same-origin scanner assets and catalog files", () => {
  assert.match(serviceWorker, /cache\.put\(request, response\.clone\(\)\)/);
  assert.match(serviceWorker, /url\.origin !== self\.location\.origin/);
  assert.match(serviceWorker, /Offline: dit onderdeel is nog niet lokaal opgeslagen/);
});
