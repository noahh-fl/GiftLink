import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePointsForGift, roundPriceToPoints } from "../lib/giftPoints.js";

test("roundPriceToPoints normalizes cents to whole points", () => {
  assert.equal(roundPriceToPoints(2599), 26);
  assert.equal(roundPriceToPoints(2500), 25);
  assert.equal(roundPriceToPoints(0), 0);
  assert.equal(roundPriceToPoints(-100), 0);
});

test("resolvePointsForGift prefers locked price points when present", () => {
  const result = resolvePointsForGift(
    "price",
    { pricePointsLocked: 18 },
    { priceCents: 4200 },
  );
  assert.deepEqual(result, { points: 18, mode: "PRICE" });
});

test("resolvePointsForGift falls back to wishlist price when no lock is set", () => {
  const result = resolvePointsForGift(
    "price",
    { pricePointsLocked: null },
    { priceCents: 3499 },
  );
  assert.deepEqual(result, { points: 35, mode: "PRICE" });
});

test("resolvePointsForGift uses sentiment values when in sentiment mode", () => {
  const result = resolvePointsForGift(
    "sentiment",
    { sentimentPoints: 14 },
    { priceCents: 9900 },
  );
  assert.deepEqual(result, { points: 14, mode: "SENTIMENT" });
});
