import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computePointsFromPriceInput, formatCurrencyFromCents, normalizePriceInput } from "./price";

describe("normalizePriceInput", () => {
  it("returns null for blank input", () => {
    assert.deepEqual(normalizePriceInput(" "), { value: null });
  });

  it("parses currency symbols and decimals", () => {
    assert.deepEqual(normalizePriceInput("$129.99"), { value: 129.99 });
  });

  it("parses comma decimal separators", () => {
    assert.deepEqual(normalizePriceInput("EUR 45,50"), { value: 45.5 });
  });

  it("flags invalid text", () => {
    assert.deepEqual(normalizePriceInput("abc"), { value: null, error: "Enter a valid price." });
  });
});

describe("computePointsFromPriceInput", () => {
  it("returns rounded points when valid", () => {
    assert.equal(computePointsFromPriceInput("$19.5"), 20);
  });

  it("returns null when price is missing", () => {
    assert.equal(computePointsFromPriceInput(" "), null);
  });
});

describe("formatCurrencyFromCents", () => {
  it("formats USD currency", () => {
    assert.equal(formatCurrencyFromCents(2599), "$25.99");
  });

  it("returns dash when value missing", () => {
    assert.equal(formatCurrencyFromCents(), "—");
  });
});
