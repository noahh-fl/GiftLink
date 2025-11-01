import type { JSX } from "react";
import PointsBadge from "./PointsBadge";
import "./RewardModal.css";

interface RewardModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string | null;
  icon?: string | null;
  points: number;
  onRedeem?: () => void;
  redeemDisabled?: boolean;
  redeemLabel?: string;
  error?: string;
  renderIcon: (icon?: string | null) => JSX.Element;
}

export default function RewardModal({
  open,
  onClose,
  title,
  description,
  icon,
  points,
  onRedeem,
  redeemDisabled,
  redeemLabel = "Redeem now",
  error,
  renderIcon,
}: RewardModalProps) {
  if (!open) {
    return null;
  }

  const badgeLabel = `${points} pts`;

  return (
    <div className="reward-modal" role="dialog" aria-modal="true" aria-labelledby="reward-modal-title">
      <div className="reward-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="reward-modal__content">
        <button type="button" className="reward-modal__close" onClick={onClose} aria-label="Close dialog">
          ✕
        </button>
        <div className="reward-modal__icon" aria-hidden="true">
          {renderIcon(icon)}
        </div>
        <h2 id="reward-modal-title" className="reward-modal__title">
          {title}
        </h2>
        <PointsBadge className="reward-modal__badge" label={badgeLabel} ariaLabel={badgeLabel} />
        {description ? <p className="reward-modal__description">{description}</p> : null}
        {error ? (
          <p className="reward-modal__error" role="alert">
            {error}
          </p>
        ) : null}
        {onRedeem ? (
          <button type="button" className="reward-modal__cta" onClick={onRedeem} disabled={redeemDisabled}>
            {redeemDisabled ? "Processing…" : redeemLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
