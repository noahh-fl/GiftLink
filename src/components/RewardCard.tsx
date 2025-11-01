import { useMemo, type JSX } from "react";
import PointsBadge from "./PointsBadge";
import "./RewardCard.css";

interface RewardCardProps {
  title: string;
  description?: string | null;
  points: number;
  icon?: string | null;
  status?: "default" | "redeemed";
  onView?: () => void;
  disabled?: boolean;
  actionLabel?: string;
}

const ICON_RENDERERS: Record<string, (label?: string) => JSX.Element> = {
  Coffee: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M18 8v-.5a1.5 1.5 0 0 0-1.5-1.5H5v6.5A5.5 5.5 0 0 0 10.5 18h2A5.5 5.5 0 0 0 18 12.5V11h1a2 2 0 0 0 0-4h-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M9 4.5c0-.8.6-1.5 1.4-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 4.5c0-.8.6-1.5 1.4-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  Sun: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M12 2v2M12 20v2M4 12H2m20 0h-2M5.6 5.6 4.2 4.2m15.6 0-1.4 1.4m0 13-1.4-1.4M5.6 18.4 4.2 19.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  Moon: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M19.5 15.5a7.5 7.5 0 1 1-9-11.5 8 8 0 0 0 9 11.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Music4: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M9 18a2 2 0 1 1-2-2 2 2 0 0 1 2 2Zm0 0V6.5l10-2V16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="18" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  Film: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M4 9h16M4 15h16" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="7" r="1" fill="currentColor" />
      <circle cx="16" cy="7" r="1" fill="currentColor" />
    </svg>
  ),
  Camera: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="7" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M15 7 14 5h-4l-1 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  BookOpen: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 6v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M20 18V6a3 3 0 0 0-3-3H12v12h5.5a2.5 2.5 0 0 1 2.5 3ZM4 18V6a3 3 0 0 1 3-3h5v12H6.5a2.5 2.5 0 0 0-2.5 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Gamepad2: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="9" width="16" height="8" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M8 13h4M10 11v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16.5" cy="13" r="1" fill="currentColor" />
      <circle cx="19" cy="13" r="1" fill="currentColor" />
    </svg>
  ),
  ChefHat: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M7 18v2h10v-2M6 18h12l1-6h-2a4 4 0 0 0-4-4h-2a4 4 0 0 0-4 4H5l1 6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 10a4 4 0 1 1 8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  Flower2: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path
        d="M12 4c1 2 3 2 4.5.6C17 7.5 19 9 21 8c-1.5 2-1.5 4 .2 5.5-2.2-.1-3.4 1.8-3.2 3.7C16.8 16 14.8 16 13 17.9 11.5 16 9.3 16 7.8 17.2c.2-1.9-1-3.8-3.2-3.7C6.3 12 6.3 10 4.8 8 6.9 9 9 7.5 9.5 4.6 11 6 13 6 14 4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Gift: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3" y="8" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M12 4v16M3 12h18" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8c-2-.5-3-1.5-3-2.5A1.5 1.5 0 0 1 10.5 4c1 0 1.5.8 1.5 2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8c2-.5 3-1.5 3-2.5A1.5 1.5 0 0 0 13.5 4C12.5 4 12 4.8 12 6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  Heart: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M19 5.5a4.5 4.5 0 0 0-7-1 4.5 4.5 0 0 0-7 1c-1.5 3 1 6 7 10.5 6-4.5 8.5-7.5 7-10.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  PenNib: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3 4 11l3 3 8-8 5 5 3-3-8-8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M11 12 5 18l1 3 3-1 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  Sparkle: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.5 13.5 9 19 10.5 13.5 12 12 17.5 10.5 12 5 10.5 10.5 9Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 4 6.8 6 9 6.8 6.8 7.6 6 9.8 5.2 7.6 3 6.8 5.2 6Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M18 14l.6 1.6L20 16.2l-1.4.6-.6 1.6-.6-1.6L16 16.2l1.4-.6Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  Crown: () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M5 18h14l1-8-4 3-3-6-3 6-4-3 1 8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

export function renderRewardIcon(name?: string | null): JSX.Element {
  if (!name) {
    return <span aria-hidden="true">🌟</span>;
  }
  const renderer = ICON_RENDERERS[name];
  if (renderer) {
    return renderer();
  }
  return <span aria-hidden="true">🌟</span>;
}

export default function RewardCard({
  title,
  description,
  points,
  icon,
  status = "default",
  onView,
  disabled,
  actionLabel,
}: RewardCardProps) {
  const badgeLabel = useMemo(() => `${points} pts`, [points]);
  const computedLabel = status === "redeemed" ? "Redeemed" : actionLabel ?? "View more";
  const buttonDisabled = disabled || status === "redeemed";

  return (
    <article className={`reward-card${status === "redeemed" ? " reward-card--redeemed" : ""}`}>
      <div className="reward-card__icon" aria-hidden="true">
        {renderRewardIcon(icon)}
      </div>
      <div className="reward-card__content">
        <header className="reward-card__header">
          <h3 className="reward-card__title">{title}</h3>
          <PointsBadge className="reward-card__badge" label={badgeLabel} ariaLabel={badgeLabel} />
        </header>
        {description ? <p className="reward-card__description">{description}</p> : null}
        <div className="reward-card__actions">
          <button
            type="button"
            className="reward-card__link"
            onClick={onView}
            disabled={buttonDisabled}
          >
            {computedLabel}
          </button>
        </div>
      </div>
    </article>
  );
}
