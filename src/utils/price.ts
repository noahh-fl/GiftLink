export interface PriceParseResult {
  value: number | null;
  error?: string;
}

export function normalizePriceInput(rawValue: string): PriceParseResult {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { value: null };
  }

  const cleaned = trimmed.replace(/[^0-9.,]/g, "").replace(/,/g, ".");
  if (!cleaned) {
    return { value: null, error: "Enter a valid price." };
  }

  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { value: null, error: "Enter a valid price." };
  }

  return { value: Number.parseFloat(parsed.toFixed(2)) };
}

export function computePointsFromPriceInput(rawValue: string): number | null {
  const result = normalizePriceInput(rawValue);
  if (result.error || result.value === null) {
    return null;
  }
  return Math.max(0, Math.round(result.value));
}

export function formatCurrencyFromCents(priceCents?: number | null): string {
  if (typeof priceCents !== "number" || Number.isNaN(priceCents)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(priceCents / 100);
}
