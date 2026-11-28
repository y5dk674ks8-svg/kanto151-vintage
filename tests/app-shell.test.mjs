import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync("index.html", "utf8");
const scriptMatch = html.match(/<script>([\\s\\S]*?)<\\/script>/);
assert.ok(scriptMatch, "index.html must contain the application script");
const script = scriptMatch[1];

test("application script parses without syntax errors", () => {
  assert.doesNotThrow(() => new vm.Script(script, { filename: "index.html inline script" }));
});

test("scanner has an explicit search action and does not silently choose Bulbasaur", () => {
  assert.match(script, /function runFreeMatch\\(/);
  assert.match(script, /Selecteer of bevestig de Pokémon/);
  assert.match(script, /Selecteer eerst de juiste Pokémon/);
});

test("scanner searches the local catalog in both supported languages", () => {
  assert.match(script, /loadLanguage\\('en'\\)/);
  assert.match(script, /loadLanguage\\('ja'\\)/);
  assert.match(script, /import\\('\\.\\/src\\/catalog-loader\\.mjs'\\)/);
});

test("scanner can request Japanese OCR and passes language to card selection", () => {
  assert.match(script, /scanLanguage==='ja'\\?'jpn'/);
  assert.match(script, /scanChooseCard\\(setId,cardId,lang='en'\\)/);
});
