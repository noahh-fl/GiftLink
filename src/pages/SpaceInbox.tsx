import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import InboxList, { type InboxItem } from "../components/InboxList";
import Button from "../ui/components/Button";
import { apiFetch } from "../utils/api";
import { getUserIdentity } from "../utils/user";
import type { SpaceOutletContext } from "./SpaceLayout";
import "./SpaceInbox.css";

type LoadState = "idle" | "loading" | "error" | "ready";

type ServerActivity = {
  id?: number;
  type?: string;
  actor?: string;
  payload?: Record<string, unknown> | null;
  createdAt?: string;
};

const SUPPORTED_TYPES = new Set(["wishlist_add", "reward_add", "reward_edit", "reward_redeem"]);

export default function SpaceInbox() {
  const { space } = useOutletContext<SpaceOutletContext>();
  const identity = getUserIdentity();

  const [items, setItems] = useState<InboxItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState("");

  const loadActivity = useCallback(async () => {
    setLoadState((previous) => (previous === "ready" ? previous : "loading"));
    setError("");

    try {
      const response = await apiFetch(`/spaces/${space.id}/activity`);
      const body = await response.json().catch(() => null);

      if (!response.ok || !body || typeof body !== "object") {
        throw new Error("Unable to load activity.");
      }

      const payload = (body as { activity?: ServerActivity[] }).activity ?? [];
      const normalized: InboxItem[] = payload.map((entry, index) => {
        const type = typeof entry.type === "string" && SUPPORTED_TYPES.has(entry.type)
          ? (entry.type as InboxItem["type"])
          : "wishlist_add";
        return {
          id: entry.id ?? index,
          type,
          actor: typeof entry.actor === "string" && entry.actor.trim() ? entry.actor : "Unknown",
          createdAt: entry.createdAt ?? new Date().toISOString(),
          payload: entry.payload ?? null,
        } satisfies InboxItem;
      });

      setItems(normalized);
      setLoadState("ready");
    } catch (activityError) {
      const message =
        activityError instanceof Error && activityError.message
          ? activityError.message
          : "Unable to load activity.";
      setError(message);
      setLoadState("error");
    }
  }, [space.id]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  return (
    <div className="space-inbox" aria-labelledby="space-inbox-title">
      <header className="space-inbox__header">
        <p className="space-inbox__eyebrow">Inbox</p>
        <h1 id="space-inbox-title" className="space-inbox__title">
          Recent activity for {space.name}
        </h1>
        <p className="space-inbox__subtitle">
          Stay in sync with wishlist updates, reward edits, and redemptions across your space.
        </p>
      </header>

      <section className="space-inbox__panel" aria-live="polite">
        {loadState === "loading" ? <p className="space-inbox__status">Loading activity…</p> : null}
        {loadState === "error" ? (
          <div className="space-inbox__error">
            <p>{error}</p>
            <Button type="button" variant="secondary" onClick={() => void loadActivity()}>
              Retry
            </Button>
          </div>
        ) : null}
        {loadState === "ready" ? <InboxList items={items} currentUserId={identity.id} /> : null}
      </section>
    </div>
  );
}
