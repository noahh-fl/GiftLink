import type { InboxItem } from "../components/InboxList";

export type ActivityType = "wishlist_add" | "reward_add" | "reward_edit" | "reward_redeem";

export interface ServerActivity {
  id?: number;
  type?: string;
  actor?: string;
  payload?: Record<string, unknown> | null;
  createdAt?: string;
}

const SUPPORTED_ACTIVITY_TYPES: ReadonlySet<ActivityType> = new Set([
  "wishlist_add",
  "reward_add",
  "reward_edit",
  "reward_redeem",
]);

function coerceActivityArray(payload: unknown): ServerActivity[] {
  if (Array.isArray(payload)) {
    return payload as ServerActivity[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const container = payload as { activity?: unknown };
  if (Array.isArray(container.activity)) {
    return container.activity as ServerActivity[];
  }

  return [];
}

export function normalizeActivityItems(payload: unknown): InboxItem[] {
  const rawItems = coerceActivityArray(payload);

  return rawItems.map((entry, index) => {
    const type =
      typeof entry.type === "string" && SUPPORTED_ACTIVITY_TYPES.has(entry.type as ActivityType)
        ? (entry.type as ActivityType)
        : "wishlist_add";

    return {
      id: typeof entry.id === "number" ? entry.id : index,
      type,
      actor:
        typeof entry.actor === "string" && entry.actor.trim().length > 0
          ? entry.actor.trim()
          : "Unknown",
      createdAt:
        typeof entry.createdAt === "string" && entry.createdAt.trim().length > 0
          ? entry.createdAt
          : new Date().toISOString(),
      payload: entry.payload ?? null,
    } satisfies InboxItem;
  });
}

export { SUPPORTED_ACTIVITY_TYPES };
