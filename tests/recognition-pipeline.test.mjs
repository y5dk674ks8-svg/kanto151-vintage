import test from "node:test";
import assert from "node:assert/strict";
import { parseCollectorNumber } from "../src/recognition-pipeline.mjs";

test("parses ordinary vintage collector numbers", () => {
  assert.deepEqual(parseCollectorNumber("4/102"), {
    number: "4", total: "102", repaired: false
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
