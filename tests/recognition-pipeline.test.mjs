import test from "node:test";
import assert from "node:assert/strict";
import { parseCollectorNumber } from "../src/recognition-pipeline.mjs";
import { selectCollectorNumberRead } from "../src/ocr-adapter.mjs";

test("parses ordinary vintage collector numbers", () => {
  assert.deepEqual(parseCollectorNumber("4/102"), {
    number: "4", total: "102", repaired: false
  });
});

test("accepts collector-number totals from Japanese and English vintage sets", () => {
  assert.deepEqual(parseCollectorNumber("12/48"), {
    number: "12", total: "48", repaired: false
  });
  assert.deepEqual(parseCollectorNumber("24/96"), {
    number: "24", total: "96", repaired: false
  });
});

test("repairs only an impossible prefixed OCR numerator", () => {
  assert.deepEqual(parseCollectorNumber("563/64"), {
    number: "63", total: "64", repaired: true
  });
});

test("does not invent a collector number from invalid or ambiguous OCR", () => {
  assert.equal(parseCollectorNumber("0/102"), null);
  assert.equal(parseCollectorNumber("63/64 or 12/102"), null);
  assert.equal(parseCollectorNumber(""), null);
});

test("accepts a single unambiguous OCR fraction", () => {
  assert.equal(selectCollectorNumberRead([{ text: "47/102", confidence: 81 }]).text, "47/102");
});

test("uses the majority when OCR passes disagree", () => {
  assert.equal(selectCollectorNumberRead([
    { text: "47/102", confidence: 80 },
    { text: "47/102", confidence: 76 },
    { text: "41/102", confidence: 72 }
  ]).text, "47/102");
});

test("keeps conflicting OCR fractions ambiguous instead of guessing", () => {
  const result = selectCollectorNumberRead([
    { text: "47/102", confidence: 80 },
    { text: "41/102", confidence: 79 }
  ]);
  assert.equal(result.confidence, null);
  assert.equal(parseCollectorNumber(result.text), null);
});
