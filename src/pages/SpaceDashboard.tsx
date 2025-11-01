import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import InboxList, { type InboxItem } from "../components/InboxList";
import Button from "../ui/components/Button";
import QuickActionButton from "../ui/components/QuickActionButton";
import StatCard from "../ui/components/StatCard";
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
  label: string;
  icon: ReactNode;
  onAction: () => void;
  disabled?: boolean;
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7m16 0H4m16-3V7a2 2 0 0 0-2-2h-3.17a2 2 0 0 0-1.66.9L12 7.5l-1.17-1.6a2 2 0 0 0-1.66-.9H6a2 2 0 0 0-2 2v2m8 0v14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M15 8a3 3 0 1 1 2.83 4H15a5 5 0 0 0-5 5v1.17A3 3 0 1 1 8 19v-2a7 7 0 0 1 7-7h2.83A3 3 0 0 1 15 8Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M9 4h6a2 2 0 0 1 2 2v2h-1.5a1.5 1.5 0 0 1-3 0H9V6a2 2 0 0 1 2-2Zm-3 4h12v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M20 11a8 8 0 0 0-13.89-5.09L4 8M4 13a8 8 0 0 0 13.89 5.09L20 16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
        id: "add-wish",
        label: "Add to wishlist",
        icon: <PlusIcon />,
        onAction: () => navigate("wishlist", { state: { openNewItem: true } }),
      },
      {
        id: "redeem",
        label: "Redeem reward",
        icon: <GiftIcon />,
        onAction: () => navigate("shop", { state: { view: "partner" } }),
      },
      {
        id: "view-wishlist",
        label: "View wishlist",
        icon: <ListIcon />,
        onAction: () => navigate("wishlist"),
      },
      {
        id: "invite",
        label: copyState === "copied" ? "Copied" : "Invite partner",
        icon: <ShareIcon />,
        onAction: handleCopy,
        disabled: !space.joinCode,
      },
    ],
    [copyState, handleCopy, navigate, space.joinCode],
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
  const modeLabel = space.mode
    ? `${space.mode.charAt(0).toUpperCase()}${space.mode.slice(1).toLowerCase()}`
    : "Price";

  return (
    <div className="space-dashboard" aria-labelledby="space-dashboard-title">
      <section className="space-dashboard__intro space-dashboard__section">
        <p className="space-dashboard__eyebrow">Dashboard</p>
        <h1 id="space-dashboard-title" className="space-dashboard__title">
          {space.name}
        </h1>
        {description ? <p className="space-dashboard__description">{description}</p> : null}
      </section>

      <section className="space-dashboard__stats space-dashboard__section" aria-label="Points overview">
        <StatCard
          label="Join code"
          actions={
            <button
              type="button"
              className="space-dashboard__icon-button"
              onClick={handleCopy}
              disabled={!space.joinCode}
              aria-label="Copy join code"
            >
              <ClipboardIcon />
            </button>
          }
          aria-live="polite"
        >
          <p className="space-dashboard__stat-value" aria-label="Join code value">
            {space.joinCode || "—"}
          </p>
          <p className="space-dashboard__stat-hint">Share this code to invite your partner.</p>
          {copyFeedback ? (
            <p className="space-dashboard__stat-hint space-dashboard__stat-hint--status" role="status">
              {copyFeedback}
            </p>
          ) : null}
        </StatCard>

        <StatCard
          label="Points"
          actions={
            <button
              type="button"
              className="space-dashboard__icon-button"
              onClick={() => void loadBalance()}
              disabled={balanceState === "loading"}
              aria-label="Refresh points balance"
            >
              <RefreshIcon />
            </button>
          }
          aria-live="polite"
        >
          {balanceState === "loading" ? (
            <div className="space-dashboard__stat-skeleton" aria-hidden="true" />
          ) : (
            <p className="space-dashboard__stat-value">{balanceLabel}</p>
          )}
          {balanceError ? (
            <p className="space-dashboard__stat-hint space-dashboard__stat-hint--error">{balanceError}</p>
          ) : (
            <p className="space-dashboard__stat-hint">Points available across your space.</p>
          )}
        </StatCard>

        <StatCard label="Mode">
          <p className="space-dashboard__stat-value">{modeLabel}</p>
          <p className="space-dashboard__stat-hint">Controls how points are calculated.</p>
        </StatCard>
      </section>

      <section className="space-dashboard__quick-actions space-dashboard__section" aria-label="Quick actions">
        <div className="space-dashboard__section-header">
          <h2 className="space-dashboard__section-title">Quick actions</h2>
        </div>
        <div className="space-dashboard__quick-actions-grid">
          {quickActions.map((action) => (
            <QuickActionButton
              key={action.id}
              icon={action.icon}
              label={action.label}
              onClick={action.onAction}
              disabled={action.disabled}
            />
          ))}
        </div>
      </section>

      <section
        className="space-dashboard__activity space-dashboard__section"
        aria-labelledby="space-dashboard-activity-title"
        aria-live="polite"
      >
        <div className="space-dashboard__section-header">
          <h2 id="space-dashboard-activity-title" className="space-dashboard__section-title">
            Recent activity
          </h2>
          <Button type="button" variant="ghost" onClick={() => navigate("inbox")}>
            View inbox
          </Button>
        </div>
        <SurfaceCard className="space-dashboard__activity-card">
          {activityState === "loading" ? (
            <div className="space-dashboard__skeleton-list" aria-hidden="true">
              <div className="space-dashboard__stat-skeleton" />
              <div className="space-dashboard__stat-skeleton" />
              <div className="space-dashboard__stat-skeleton" />
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

      <footer className="space-dashboard__footer">
        <Button
          type="button"
          variant="secondary"
          className="space-dashboard__settings-button"
          onClick={() => navigate("settings")}
        >
          Settings
        </Button>
      </footer>

      {import.meta.env.DEV ? <SpaceDebugPanel activeSpaceId={space.id} onRefresh={refreshSpace} /> : null}
    </div>
  );
}
