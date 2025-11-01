import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import Button from "../ui/components/Button";
import FormField from "../ui/components/FormField";
import Input from "../ui/components/Input";
import PageHeader from "../ui/components/PageHeader";
import PointsBadge from "../components/PointsBadge";
import RewardCard, { renderRewardIcon } from "../components/RewardCard";
import RewardModal from "../components/RewardModal";
import ShopTabs from "../components/ShopTabs";
import { rewardIdeas } from "../data/rewardIdeas";
import { useToast } from "../contexts/ToastContext";
import { apiFetch } from "../utils/api";
import { getUserIdentity } from "../utils/user";
import type { SpaceOutletContext } from "./SpaceLayout";
import "./SpacePointShop.css";

const ICON_CHOICES = [
  "Coffee",
  "Sun",
  "Moon",
  "Music4",
  "Film",
  "Camera",
  "BookOpen",
  "Gamepad2",
  "ChefHat",
  "Flower2",
  "Gift",
  "Heart",
  "PenNib",
  "Sparkle",
  "Crown",
] as const;

type IconChoice = (typeof ICON_CHOICES)[number];

type LoadState = "idle" | "loading" | "error" | "ready";
type ViewMode = "mine" | "partner";

interface Reward {
  id: number;
  title: string;
  points: number;
  description?: string | null;
  ownerKey?: string;
  userId: string;
  updatedAt?: string;
  icon?: string | null;
}

export default function SpacePointShop() {
  const { space } = useOutletContext<SpaceOutletContext>();
  const location = useLocation();
  const navigate = useNavigate();
  const identity = getUserIdentity();
  const { showToast } = useToast();

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<ViewMode>("mine");

  const [title, setTitle] = useState("");
  const [points, setPoints] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<string>("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState("");

  const [modalReward, setModalReward] = useState<Reward | null>(null);
  const [modalError, setModalError] = useState("");
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [redeemedIds, setRedeemedIds] = useState<number[]>([]);

  useEffect(() => {
    const state = location.state as { view?: ViewMode } | null;
    if (state?.view) {
      const nextView: ViewMode = state.view === "partner" ? "partner" : "mine";
      setView(nextView);
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

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
          icon: reward.icon ?? null,
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

  const loadBalance = useCallback(async () => {
    try {
      const response = await apiFetch(`/spaces/${space.id}/balance`);
      const body = await response.json().catch(() => null);

      if (!response.ok || !body || typeof body !== "object") {
        throw new Error("Unable to load balance.");
      }

      const rawPoints = (body as { points?: unknown }).points;
      const numericPoints = typeof rawPoints === "number" ? rawPoints : Number.parseInt(String(rawPoints ?? 0), 10);
      setBalance(Number.isFinite(numericPoints) ? numericPoints : 0);
      setBalanceError("");
    } catch {
      setBalance(null);
      setBalanceError("Unable to load balance.");
    }
  }, [space.id]);

  useEffect(() => {
    void loadRewards();
  }, [loadRewards]);

  useEffect(() => {
    void loadBalance();
  }, [loadBalance]);

  const myRewards = useMemo(
    () => rewards.filter((reward) => reward.userId === identity.id),
    [rewards, identity.id],
  );
  const partnerRewards = useMemo(
    () => rewards.filter((reward) => reward.userId !== identity.id),
    [rewards, identity.id],
  );

  const displayedRewards = view === "mine" ? myRewards : partnerRewards;

  function resetForm() {
    setTitle("");
    setPoints("");
    setDescription("");
    setIcon("");
    setEditingId(null);
    setFormError("");
  }

  function startEdit(reward: Reward) {
    setEditingId(reward.id);
    setTitle(reward.title);
    setPoints(String(reward.points));
    setDescription(reward.description ?? "");
    setIcon(reward.icon ?? "");
    setFormError("");
    setView("mine");
  }

  useEffect(() => {
    if (view === "partner") {
      resetForm();
    }
  }, [view]);

  const handleRandomize = useCallback(() => {
    const idea = rewardIdeas[Math.floor(Math.random() * rewardIdeas.length)];
    setTitle(idea.title);
    setDescription(idea.description);
    setIcon(idea.icon);
  }, []);

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
        icon: icon ? icon : null,
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
        throw new Error(editingId !== null ? "Unable to update reward." : "Unable to create reward.");
      }

      const rewardPayload = (body as { reward?: Reward }).reward ?? (body as Reward);
      const normalized: Reward = {
        id: rewardPayload.id ?? editingId ?? 0,
        title: rewardPayload.title ?? trimmedTitle,
        points: rewardPayload.points ?? parsedPoints,
        description: rewardPayload.description ?? (trimmedDescription || null),
        ownerKey: rewardPayload.ownerKey ?? identity.id,
        userId: identity.id,
        updatedAt: rewardPayload.updatedAt,
        icon: rewardPayload.icon ?? (icon || null),
      };

      if (editingId !== null) {
        setRewards((previous) => previous.map((item) => (item.id === editingId ? normalized : item)));
      } else {
        setRewards((previous) => [normalized, ...previous]);
      }

      resetForm();
      setView("mine");
      showToast({ intent: "success", description: editingId !== null ? "Reward updated." : "Reward added." });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : editingId !== null
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

  const handleIconToggle = (choice: IconChoice) => {
    setIcon((previous) => (previous === choice ? "" : choice));
  };

  const openRewardDetails = (reward: Reward) => {
    setModalReward(reward);
    setModalError("");
  };

  const closeRewardDetails = () => {
    if (redeemingId !== null) {
      return;
    }
    setModalReward(null);
    setModalError("");
  };

  const handleRedeem = useCallback(async () => {
    if (!modalReward) {
      return;
    }

    if (redeemedIds.includes(modalReward.id)) {
      setModalError("Reward already redeemed.");
      return;
    }

    setRedeemingId(modalReward.id);
    setModalError("");

    try {
      const response = await apiFetch(`/spaces/${space.id}/rewards/${modalReward.id}/redeem`, {
        method: "POST",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok || !body || typeof body !== "object") {
        const message =
          body && typeof (body as { message?: string }).message === "string"
            ? (body as { message: string }).message
            : "Unable to redeem reward.";
        if (response.status === 403) {
          setModalError(message);
          return;
        }
        throw new Error(message);
      }

      const balancePayload = (body as { balance?: { points?: number } }).balance;
      if (balancePayload && typeof balancePayload.points === "number" && Number.isFinite(balancePayload.points)) {
        setBalance(balancePayload.points);
        setBalanceError("");
      }

      setRedeemedIds((previous) => (previous.includes(modalReward.id) ? previous : [...previous, modalReward.id]));
      showToast({ intent: "success", description: `Redeemed "${modalReward.title}".` });
      setModalReward(null);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Unable to redeem reward.";
      setModalError(message);
    } finally {
      setRedeemingId(null);
    }
  }, [modalReward, redeemedIds, showToast, space.id]);

  const balanceLabel = balance !== null ? `${balance} pts` : "—";
  const partnerEmptyMessage =
    "No partner rewards yet. Encourage them to add treats in their shop.";
  const myEmptyMessage = "You haven’t listed any rewards yet. Add something cozy or fun.";

  const modalRedeemed = modalReward ? redeemedIds.includes(modalReward.id) : false;

  return (
    <div className="space-shop" aria-labelledby="space-shop-title">
      <PageHeader
        eyebrow="Gift shop"
        title={`Rewards for ${space.name}`}
        titleId="space-shop-title"
        description="Earn points from confirmed gifts, then spend them on thoughtful experiences or favors."
        actions={
          <div className="space-shop__header-actions">
            <div className="space-shop__balance" aria-live="polite">
              <span className="space-shop__balance-label">Points balance</span>
              <PointsBadge className="space-shop__balance-badge" label={balanceLabel} ariaLabel={`${balanceLabel} available`} />
              {balanceError ? <span className="space-shop__balance-error">{balanceError}</span> : null}
            </div>
            <ShopTabs
              ariaLabel="Gift shop view"
              value={view}
              tabs={[
                { value: "mine", label: "My shop" },
                { value: "partner", label: "Partner shop" },
              ]}
              onChange={(next) => setView(next as ViewMode)}
            />
          </div>
        }
      />

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

          <div className="space-shop__form-toolbar">
            <Button type="button" variant="secondary" onClick={handleRandomize} disabled={submitting}>
              Randomize idea
            </Button>
          </div>

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

          <fieldset className="space-shop__icons">
            <legend>Icon (optional)</legend>
            <div className="space-shop__icon-grid">
              {ICON_CHOICES.map((choice) => {
                const active = icon === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    className={active ? "space-shop__icon-button space-shop__icon-button--active" : "space-shop__icon-button"}
                    onClick={() => handleIconToggle(choice)}
                    aria-pressed={active}
                    disabled={submitting}
                  >
                    <span className="space-shop__icon-visual">{renderRewardIcon(choice)}</span>
                    <span className="space-shop__icon-name">{choice}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

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
      ) : null}

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
        {loadState === "ready" && displayedRewards.length === 0 ? (
          <p className="space-shop__empty">{view === "mine" ? myEmptyMessage : partnerEmptyMessage}</p>
        ) : null}

        {loadState === "ready" && displayedRewards.length > 0 ? (
          view === "partner" ? (
            <div className="space-shop__reward-grid">
              {displayedRewards.map((reward) => {
                const redeemed = redeemedIds.includes(reward.id);
                return (
                  <RewardCard
                    key={reward.id}
                    title={reward.title}
                    description={reward.description}
                    points={reward.points}
                    icon={reward.icon}
                    status={redeemed ? "redeemed" : "default"}
                    onView={() => openRewardDetails(reward)}
                    disabled={redeemed}
                  />
                );
              })}
            </div>
          ) : (
            <div className="space-shop__list-grid">
              {displayedRewards.map((reward) => (
                <div key={reward.id} className="space-shop__list-card">
                  <RewardCard
                    title={reward.title}
                    description={reward.description}
                    points={reward.points}
                    icon={reward.icon}
                    onView={() => startEdit(reward)}
                    actionLabel="Edit details"
                    disabled={submitting || deletingId === reward.id}
                  />
                  <div className="space-shop__list-footer">
                    <p className="space-shop__timestamp">
                      Updated {reward.updatedAt ? new Date(reward.updatedAt).toLocaleDateString() : "recently"}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleDelete(reward.id)}
                      disabled={deletingId === reward.id || submitting}
                    >
                      {deletingId === reward.id ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : null}
      </section>

      <RewardModal
        open={modalReward !== null}
        onClose={closeRewardDetails}
        title={modalReward?.title ?? ""}
        description={modalReward?.description}
        icon={modalReward?.icon}
        points={modalReward?.points ?? 0}
        onRedeem={!modalRedeemed ? handleRedeem : undefined}
        redeemDisabled={modalRedeemed || redeemingId === modalReward?.id}
        redeemLabel={modalRedeemed ? "Redeemed" : "Redeem now"}
        error={modalError}
        renderIcon={renderRewardIcon}
      />
    </div>
  );
}
