import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractWishlistItems } from "../SpaceWishlist";

describe("extractWishlistItems", () => {
  it("returns an empty array when gifts are undefined", () => {
    const items = extractWishlistItems({ gifts: undefined });
    assert.deepEqual(items, []);
  });

  it("returns an empty array when payload is an empty list", () => {
    const items = extractWishlistItems([]);
    assert.deepEqual(items, []);
  });

  it("normalizes wishlist items", () => {
    const items = extractWishlistItems([
      { id: 10, title: "Sample", priceCents: 2599, notes: "note" },
      { id: "20", title: "  ", priceCents: 1000 },
    ]);
    assert.equal(items?.length, 2);
    assert.equal(items?.[0].title, "Sample");
    assert.equal(items?.[1].title, "Gift #20");
  });

  it("returns null when payload is not recognized", () => {
    assert.equal(extractWishlistItems({}), null);
  });
});
