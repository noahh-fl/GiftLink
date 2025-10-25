export const POINT_MODES = {
  PRICE: "PRICE",
  SENTIMENT: "SENTIMENT",
};

export function roundPriceToPoints(priceCents) {
  if (typeof priceCents !== "number" || Number.isNaN(priceCents)) {
    return 0;
  }
  const normalized = Math.round(priceCents / 100);
  if (!Number.isFinite(normalized) || normalized < 0) {
    return 0;
  }
  return normalized;
}

export function resolvePointsForGift(spaceMode, gift, wishlistItem) {
  const normalizedMode = typeof spaceMode === "string" ? spaceMode.toLowerCase() : "price";
  if (normalizedMode === "sentiment") {
    const sentiment = gift?.sentimentPoints;
    if (typeof sentiment !== "number" || !Number.isFinite(sentiment) || sentiment < 0) {
      return { points: 0, mode: POINT_MODES.SENTIMENT };
    }
    return { points: Math.trunc(sentiment), mode: POINT_MODES.SENTIMENT };
  }

  const locked = gift?.pricePointsLocked;
  if (typeof locked === "number" && Number.isFinite(locked)) {
    return { points: Math.max(0, Math.trunc(locked)), mode: POINT_MODES.PRICE };
  }

  const fallback = roundPriceToPoints(wishlistItem?.priceCents ?? null);
  return { points: fallback, mode: POINT_MODES.PRICE };
}
