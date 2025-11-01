import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import InboxList, { type InboxItem } from "../components/InboxList";
import PointsBadge from "../components/PointsBadge";
import Button from "../ui/components/Button";
import PageHeader from "../ui/components/PageHeader";
import SurfaceCard from "../ui/components/SurfaceCard";
import { apiFetch } from "../utils/api";
import { normalizeActivityItems } from "../utils/activity";
import { getUserIdentity } from "../utils/user";
import type { SpaceOutletContext } from "./SpaceLayout";
import SpaceDebugPanel from "./SpaceDebugPanel";
import "./SpaceDashboard.css";

type CopyState = "idle" | "copied" | "error";
type LoadState = "idle" | "loading" | "error" | "ready";

interface QuickAction {
  id: string;
  title: string;
  description: string;
  cta: string;
  onAction: () => void;
  icon: string;
}

export default function SpaceDashboard() {
  const { space, refreshSpace } = useOutletContext<SpaceOutletContext>();
  const navigate = useNavigate();
  const identity = getUserIdentity();

  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceState, setBalanceState] = useState<LoadState>("idle");
  const [balanceError, setBalanceError] = useState("");
  const [activity, setActivity] = useState<InboxItem[]>([]);
  const [activityState, setActivityState] = useState<LoadState>("idle");
  const [activityError, setActivityError] = useState("");

  useEffect(() => {
    setCopyState("idle");
  }, [space.joinCode]);

  const loadBalance = useCallback(async () => {
    setBalanceState((previous) => (previous === "ready" ? previous : "loading"));
    setBalanceError("");

    try {
      const response = await apiFetch(`/spaces/${space.id}/balance`);
      const body = await response.json().catch(() => null);

      if (!response.ok || !body || typeof body !== "object") {
        throw new Error("Unable to load points balance.");
      }

      const balancePayload = (body as { balance?: { points?: number } }).balance;
      const nextBalance = balancePayload && typeof balancePayload.points === "number" ? balancePayload.points : null;

      if (typeof nextBalance === "number" && Number.isFinite(nextBalance)) {
        setBalance(nextBalance);
        setBalanceState("ready");
      } else {
        setBalance(null);
        setBalanceState("error");
        setBalanceError("Balance unavailable.");
      }
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Unable to load points balance.";
      setBalanceState("error");
      setBalanceError(message);
    }
  }, [space.id]);

  const loadActivity = useCallback(async () => {
    setActivityState((previous) => (previous === "ready" ? previous : "loading"));
    setActivityError("");

    try {
      const response = await apiFetch(`/spaces/${space.id}/activity`);
      const body = await response.json().catch(() => null);

      if (!response.ok || !body || typeof body !== "object") {
        throw new Error("Unable to load activity.");
      }

      const payload = (body as { activity?: unknown }).activity ?? [];
      const normalized = normalizeActivityItems(payload);
      setActivity(normalized.slice(0, 5));
      setActivityState("ready");
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Unable to load activity.";
      setActivityState("error");
      setActivityError(message);
    }
  }, [space.id]);

  useEffect(() => {
    void loadBalance();
    void loadActivity();
  }, [loadBalance, loadActivity]);

  const handleCopy = useCallback(async () => {
    if (!space.joinCode) {
      return;
    }

    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      setCopyState("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(space.joinCode);
      setCopyState("copied");
    } catch (error) {
      console.error("Unable to copy join code", error);
      setCopyState("error");
    }
  }, [space.joinCode]);

  const quickActions: QuickAction[] = useMemo(
    () => [
      {
        id: "wishlist",
        title: "Add to wishlist",
        description: "Paste a link and track the gift details instantly.",
        cta: "New wish",
        onAction: () => navigate("wishlist", { state: { openNewItem: true } }),
        icon: "➕",
      },
      {
        id: "redeem",
        title: "Redeem reward",
        description: "Browse your partner’s shop and spend your earned points.",
        cta: "Open partner shop",
        onAction: () => navigate("shop", { state: { view: "partner" } }),
        icon: "🎁",
      },
      {
        id: "manage",
        title: "Manage rewards",
        description: "Craft experiences or favors to motivate each other.",
        cta: "Open my shop",
        onAction: () => navigate("shop", { state: { view: "mine" } }),
        icon: "✨",
      },
      {
        id: "share",
        title: "Share join code",
        description: "Copy the invite code to bring your partner into the space.",
        cta: copyState === "copied" ? "Copied" : "Copy code",
        onAction: handleCopy,
        icon: "🔗",
      },
    ],
    [copyState, handleCopy, navigate],
  );

  const copyFeedback =
    copyState === "copied"
      ? "Join code copied to clipboard"
      : copyState === "error"
        ? "Copy unavailable — copy manually"
        : "";

  const description = space.description
    ? space.description
    : "Share your space, collect wishes, and coordinate rewards together.";

  const balanceLabel = balance !== null ? `${balance} pts` : "—";

  return (
    <div className="space-dashboard" aria-labelledby="space-dashboard-title">
      <PageHeader
        eyebrow="Dashboard"
        title={space.name}
        titleId="space-dashboard-title"
        description={description}
        actions={
          <>
            <Button type="button" onClick={() => navigate("wishlist", { state: { openNewItem: true } })}>
              Add wish
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate("shop")}> 
              Visit shop
            </Button>
          </>
        }
      />

      <section className="space-dashboard__summary" aria-label="Space summary">
        <SurfaceCard className="space-dashboard__summary-card" aria-live="polite">
          <div className="space-dashboard__summary-header">
            <p className="space-dashboard__label">Join code</p>
            <Button type="button" variant="secondary" onClick={handleCopy}>
              {copyState === "copied" ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="space-dashboard__code" aria-label="Join code value">
            {space.joinCode || "—"}
          </p>
          {copyFeedback ? (
            <p className="space-dashboard__hint" role="status">
              {copyFeedback}
            </p>
          ) : null}
        </SurfaceCard>

        <SurfaceCard className="space-dashboard__summary-card" aria-live="polite">
          <div className="space-dashboard__summary-header">
            <p className="space-dashboard__label">Points balance</p>
            <Button type="button" variant="ghost" onClick={() => void loadBalance()}>
              Refresh
            </Button>
          </div>
          {balanceState === "loading" ? (
            <div className="space-dashboard__skeleton" aria-hidden="true" />
          ) : (
            <PointsBadge label={balanceLabel} ariaLabel={`${balanceLabel} available`} />
          )}
          {balanceError ? <p className="space-dashboard__hint space-dashboard__hint--error">{balanceError}</p> : null}
        </SurfaceCard>

        <SurfaceCard className="space-dashboard__summary-card">
          <p className="space-dashboard__label">Point mode</p>
          <p className="space-dashboard__mode-value">{space.mode ?? "Price"}</p>
          <p className="space-dashboard__hint">Mode controls how points are calculated for wishes.</p>
        </SurfaceCard>
      </section>

      <section className="space-dashboard__actions" aria-label="Quick actions">
        <div className="space-dashboard__section-header">
          <h2 className="space-dashboard__section-title">Quick actions</h2>
        </div>
        <div className="space-dashboard__action-grid">
          {quickActions.map((action) => (
            <SurfaceCard key={action.id} className="space-dashboard__action-card">
              <span className="space-dashboard__action-icon" aria-hidden="true">
                {action.icon}
              </span>
              <div className="space-dashboard__action-body">
                <h3 className="space-dashboard__action-title">{action.title}</h3>
                <p className="space-dashboard__action-description">{action.description}</p>
              </div>
              <Button type="button" variant="secondary" onClick={action.onAction}>
                {action.cta}
              </Button>
            </SurfaceCard>
          ))}
        </div>
      </section>

      <section className="space-dashboard__activity" aria-labelledby="space-dashboard-activity-title" aria-live="polite">
        <div className="space-dashboard__section-header">
          <h2 id="space-dashboard-activity-title" className="space-dashboard__section-title">
            Recent activity
          </h2>
          <Button type="button" variant="ghost" onClick={() => navigate("inbox")}>View inbox</Button>
        </div>
        <SurfaceCard className="space-dashboard__activity-card">
          {activityState === "loading" ? (
            <div className="space-dashboard__skeleton-list" aria-hidden="true">
              <div className="space-dashboard__skeleton" />
              <div className="space-dashboard__skeleton" />
              <div className="space-dashboard__skeleton" />
            </div>
          ) : null}
          {activityState === "error" ? (
            <div className="space-dashboard__activity-error">
              <p>{activityError}</p>
              <Button type="button" variant="secondary" onClick={() => void loadActivity()}>
                Retry
              </Button>
            </div>
          ) : null}
          {activityState === "ready" ? <InboxList items={activity} currentUserId={identity.id} /> : null}
        </SurfaceCard>
      </section>

      {import.meta.env.DEV ? <SpaceDebugPanel activeSpaceId={space.id} onRefresh={refreshSpace} /> : null}
    </div>
  );
}
