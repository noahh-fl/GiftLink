import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import Button from "../ui/components/Button";
import FormField from "../ui/components/FormField";
import Input from "../ui/components/Input";
import PointsBadge from "../components/PointsBadge";
import { useToast } from "../contexts/ToastContext";
import { apiFetch } from "../utils/api";
import { getUserIdentity } from "../utils/user";
import type { SpaceOutletContext } from "./SpaceLayout";
import "./SpacePointShop.css";

interface Reward {
  id: number;
  title: string;
  points: number;
  description?: string | null;
  ownerKey?: string;
  userId: string;
  updatedAt?: string;
}

type LoadState = "idle" | "loading" | "error" | "ready";
type ViewMode = "mine" | "others";

export default function SpacePointShop() {
  const { space } = useOutletContext<SpaceOutletContext>();
  const identity = getUserIdentity();
  const { showToast } = useToast();

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [view, setView] = useState<ViewMode>("mine");
  const [title, setTitle] = useState("");
  const [points, setPoints] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadRewards = useCallback(async () => {
    setLoadState((previous) => (previous === "ready" ? previous : "loading"));
    setLoadError("");

    try {
      const response = await apiFetch(`/spaces/${space.id}/rewards`);
      const body = await response.json().catch(() => null);

      if (!response.ok || !body || typeof body !== "object") {
        throw new Error("Unable to load rewards.");
      }

      const payload = (body as { rewards?: Partial<Reward>[] }).rewards ?? [];
      const normalized = payload.map((reward) => {
        const owner = reward.userId ?? reward.ownerKey ?? "unknown";
        return {
          id: reward.id ?? 0,
          title: reward.title ?? "Untitled reward",
          points: reward.points ?? 0,
          description: reward.description ?? null,
          ownerKey: reward.ownerKey ?? owner,
          userId: owner,
          updatedAt: reward.updatedAt,
        } satisfies Reward;
      });
      setRewards(normalized);
      setLoadState("ready");
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Unable to load rewards.";
      setLoadError(message);
      setLoadState("error");
    }
  }, [space.id]);

  useEffect(() => {
    void loadRewards();
  }, [loadRewards]);

  const filteredRewards = useMemo(() => {
    if (view === "mine") {
      return rewards.filter((reward) => reward.userId === identity.id);
    }
    return rewards.filter((reward) => reward.userId !== identity.id);
  }, [identity.id, rewards, view]);

  function resetForm() {
    setTitle("");
    setPoints("");
    setDescription("");
    setEditingId(null);
    setFormError("");
  }

  function startEdit(reward: Reward) {
    setEditingId(reward.id);
    setTitle(reward.title);
    setPoints(String(reward.points));
    setDescription(reward.description ?? "");
    setFormError("");
    setView("mine");
  }

  useEffect(() => {
    if (view === "others") {
      resetForm();
    }
  }, [view]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const trimmedPoints = points.trim();

    if (!trimmedTitle) {
      setFormError("Title is required.");
      return;
    }

    const parsedPoints = Number.parseInt(trimmedPoints, 10);
    if (!Number.isFinite(parsedPoints) || parsedPoints <= 0) {
      setFormError("Points must be a positive number.");
      return;
    }

    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        title: trimmedTitle,
        points: parsedPoints,
      };

      if (trimmedDescription) {
        payload.description = trimmedDescription;
      }

      let response: Response;
      if (editingId !== null) {
        response = await apiFetch(`/spaces/${space.id}/rewards/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        response = await apiFetch(`/spaces/${space.id}/rewards`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      const body = await response.json().catch(() => null);

      if (!response.ok || !body || typeof body !== "object") {
        throw new Error(editingId ? "Unable to update reward." : "Unable to create reward.");
      }

      const reward = (body as { reward: Reward }).reward ?? (body as Reward);
      if (editingId !== null) {
        setRewards((previous) => previous.map((item) => (item.id === editingId ? { ...reward, userId: identity.id } : item)));
      } else {
        setRewards((previous) => [{ ...reward, userId: identity.id }, ...previous]);
      }

      resetForm();
      setView("mine");
      showToast({ intent: "success", description: editingId !== null ? "Reward updated." : "Reward added." });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : editingId
            ? "Unable to update reward."
            : "Unable to create reward.";
      setFormError(message);
      showToast({ intent: "error", description: message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(rewardId: number) {
    if (!window.confirm("Delete this reward?")) {
      return;
    }

    setDeletingId(rewardId);

    try {
      const response = await apiFetch(`/spaces/${space.id}/rewards/${rewardId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message =
          body && typeof body === "object" && typeof (body as { message?: string }).message === "string"
            ? (body as { message: string }).message
            : "Unable to delete reward.";
        throw new Error(message);
      }

      setRewards((previous) => previous.filter((item) => item.id !== rewardId));
      if (editingId === rewardId) {
        resetForm();
      }
      showToast({ intent: "success", description: "Reward deleted." });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Unable to delete reward.";
      showToast({ intent: "error", description: message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-shop" aria-labelledby="space-shop-title">
      <header className="space-shop__header">
        <div>
          <p className="space-shop__eyebrow">Gift shop</p>
          <h1 id="space-shop-title" className="space-shop__title">
            Rewards for {space.name}
          </h1>
          <p className="space-shop__subtitle">
            Earn points from gifts, then spend them on thoughtful experiences or favors.
          </p>
        </div>
        <div className="space-shop__view-toggle" role="radiogroup" aria-label="Choose view">
          <button
            type="button"
            className={view === "mine" ? "space-shop__toggle space-shop__toggle--active" : "space-shop__toggle"}
            onClick={() => setView("mine")}
            aria-pressed={view === "mine"}
          >
            My rewards
          </button>
          <button
            type="button"
            className={view === "others" ? "space-shop__toggle space-shop__toggle--active" : "space-shop__toggle"}
            onClick={() => setView("others")}
            aria-pressed={view === "others"}
          >
            Partner view
          </button>
        </div>
      </header>

      {view === "mine" ? (
        <form className="space-shop__form" onSubmit={handleSubmit} noValidate>
          <FormField htmlFor="reward-title" label="Reward title" required>
            <Input
              id="reward-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Breakfast in bed"
              disabled={submitting}
            />
          </FormField>

          <FormField htmlFor="reward-points" label="Points" hint="Whole numbers only" required>
            <Input
              id="reward-points"
              value={points}
              onChange={(event) => setPoints(event.target.value)}
              placeholder="40"
              disabled={submitting}
              inputMode="numeric"
            />
          </FormField>

          <FormField htmlFor="reward-description" label="Description" hint="Optional details for the redeemer.">
            <Input
              id="reward-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Tell us what’s included or how to redeem it"
              disabled={submitting}
            />
          </FormField>

          {formError ? (
            <p className="space-shop__status space-shop__status--error" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="space-shop__form-actions">
            {editingId !== null ? (
              <Button type="button" variant="secondary" onClick={() => resetForm()} disabled={submitting}>
                Cancel edit
              </Button>
            ) : null}
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : editingId !== null ? "Update reward" : "Add reward"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-shop__form space-shop__form--inactive" aria-live="polite">
          <p className="space-shop__partner-note">
            Switch to “My rewards” to add or edit your own treats. Partner rewards are read-only here.
          </p>
        </div>
      )}

      <section className="space-shop__list" aria-live="polite">
        {loadState === "loading" ? <p className="space-shop__loading">Loading rewards…</p> : null}
        {loadState === "error" ? (
          <div className="space-shop__error">
            <p>{loadError}</p>
            <Button type="button" variant="secondary" onClick={() => void loadRewards()}>
              Retry
            </Button>
          </div>
        ) : null}
        {loadState === "ready" && filteredRewards.length === 0 ? (
          <p className="space-shop__empty">
            {view === "mine"
              ? "You haven’t listed any rewards yet. Add something cozy or fun."
              : "No partner rewards yet. Encourage them to add a few treats."}
          </p>
        ) : null}
        {loadState === "ready" && filteredRewards.length > 0 ? (
          <div className="space-shop__grid">
            {filteredRewards.map((reward) => (
              <article key={reward.id} className="space-shop__item">
                <header className="space-shop__item-header">
                  <h2>{reward.title}</h2>
                  <PointsBadge
                    className="space-shop__points-badge"
                    label={`${reward.points} pts`}
                    ariaLabel={`${reward.points} points`}
                  />
                </header>
                {reward.description ? <p className="space-shop__description">{reward.description}</p> : null}
                {reward.userId === identity.id && view === "mine" ? (
                  <div className="space-shop__item-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => startEdit(reward)}
                      disabled={submitting || deletingId === reward.id}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleDelete(reward.id)}
                      disabled={deletingId === reward.id || submitting}
                    >
                      {deletingId === reward.id ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                ) : null}
                <footer>
                  <p className="space-shop__timestamp">
                    Updated {reward.updatedAt ? new Date(reward.updatedAt).toLocaleDateString() : "recently"}
                  </p>
                </footer>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
