import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import InboxList, { type InboxItem } from "../components/InboxList";
import Button from "../ui/components/Button";
import PageHeader from "../ui/components/PageHeader";
import { apiFetch } from "../utils/api";
import { normalizeActivityItems } from "../utils/activity";
import { getUserIdentity } from "../utils/user";
import type { SpaceOutletContext } from "./SpaceLayout";
import "./SpaceInbox.css";

type LoadState = "idle" | "loading" | "error" | "ready";

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

      const payload = (body as { activity?: unknown }).activity ?? [];
      const normalized: InboxItem[] = normalizeActivityItems(payload);

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
      <PageHeader
        eyebrow="Inbox"
        title={`Recent activity for ${space.name}`}
        titleId="space-inbox-title"
        description="Stay in sync with wishlist updates, reward edits, and redemptions across your space."
      />

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
