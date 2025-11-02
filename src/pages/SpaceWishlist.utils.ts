export type WishlistGift = {
  status?: string | null;
  sentimentPoints?: number | null;
  pricePointsLocked?: number | null;
  giverId?: string | null;
} | null;

export type WishlistItem = {
  id: number;
  title: string;
  url?: string | null;
  image?: string | null;
  priceCents?: number | null;
  notes?: string | null;
  createdAt?: string;
  gift?: WishlistGift;
  points?: number | null;
};

function sanitizeWishlistItem(raw: unknown): WishlistItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<WishlistItem> & { id?: unknown };
  const numericId =
    typeof candidate.id === "number"
      ? candidate.id
      : Number.parseInt(typeof candidate.id === "string" ? candidate.id : "", 10);

  if (!Number.isFinite(numericId)) {
    return null;
  }

  const safeTitle =
    typeof candidate.title === "string" && candidate.title.trim()
      ? candidate.title.trim()
      : `Gift #${numericId}`;

  return {
    id: numericId,
    title: safeTitle,
    url: typeof candidate.url === "string" ? candidate.url : null,
    image: typeof candidate.image === "string" ? candidate.image : null,
    priceCents: typeof candidate.priceCents === "number" ? candidate.priceCents : null,
    notes: typeof candidate.notes === "string" ? candidate.notes : null,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : undefined,
    gift: candidate.gift ?? null,
    points: typeof candidate.points === "number" ? candidate.points : null,
  };
}

export function resolveItemPoints(item: WishlistItem): number {
  if (typeof item.points === "number") {
    return item.points;
  }
  if (typeof item.gift?.sentimentPoints === "number") {
    return item.gift.sentimentPoints;
  }
  if (typeof item.gift?.pricePointsLocked === "number") {
    return item.gift.pricePointsLocked;
  }
  if (typeof item.priceCents === "number") {
    return Math.max(0, Math.round(item.priceCents / 100));
  }
  return 0;
}

export function extractWishlistItems(payload: unknown): WishlistItem[] | null {
  let source: unknown;

  if (Array.isArray(payload)) {
    source = payload;
  } else if (payload && typeof payload === "object") {
    const container = payload as {
      gifts?: unknown;
      items?: unknown;
      wishlist?: unknown;
      wishlistItems?: unknown;
    };

    if (Array.isArray(container.gifts)) {
      source = container.gifts;
    } else if (Array.isArray(container.wishlistItems)) {
      source = container.wishlistItems;
    } else if (Array.isArray(container.items)) {
      source = container.items;
    } else if (Array.isArray(container.wishlist)) {
      source = container.wishlist;
    } else if (
      "gifts" in container ||
      "items" in container ||
      "wishlist" in container ||
      "wishlistItems" in container
    ) {
      return [];
    } else {
      return null;
    }
  } else {
    return null;
  }

  const list = Array.isArray(source) ? source : [];
  return list
    .map((item) => sanitizeWishlistItem(item))
    .filter((item): item is WishlistItem => item !== null);
}
