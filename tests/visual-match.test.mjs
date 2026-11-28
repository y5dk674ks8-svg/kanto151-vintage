import test from "node:test";
import assert from "node:assert/strict";
import { hammingDistance, compareVisualFeatures } from "../src/visual-match.mjs";

test("perceptual hash distance counts differing bits", () => {
  assert.equal(hammingDistance("0000000000000000", "0000000000000000"), 0);
  assert.equal(hammingDistance("0000000000000001", "0000000000000000"), 1);
  assert.equal(hammingDistance("ffffffffffffffff", "0000000000000000"), 64);
});

test("identical visual descriptors score higher than different descriptors", () => {
  const same = {
    hash: "0000000000000000",
    footer: "0000000000000000",
    tiles: Array(16).fill("0000000000000000"),
    hist: Array(20).fill(0.05)
  };
  const different = {
    hash: "ffffffffffffffff",
    footer: "ffffffffffffffff",
    tiles: Array(16).fill("ffffffffffffffff"),
    hist: Array(20).fill(0.05)
  };
  assert.equal(compareVisualFeatures(same, same), 1);
  assert.ok(compareVisualFeatures(same, same) > compareVisualFeatures(same, different));
});
