import { useMemo, useState } from "react";
import type { Gift } from "../types/gift";
import "./GiftCard.css";

interface GiftCardProps {
  gift: Gift;
  onConfirm: (giftId: number) => Promise<void>;
}

export function GiftCard({ gift, onConfirm }: GiftCardProps) {
  const [confirming, setConfirming] = useState(false);
  const formattedPrice = useMemo(() => {
    if (gift.price === null || Number.isNaN(gift.price)) return null;
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(gift.price);
    } catch {
      return gift.price.toString();
    }
  }, [gift.price]);

  const statusLabel = gift.confirmed ? "Confirmed" : "Awaiting confirmation";

  async function handleConfirm() {
    if (gift.confirmed || confirming) return;
    setConfirming(true);
    try {
      await onConfirm(gift.id);
    } finally {
      setConfirming(false);
    }
  }

  const fallbackLetter =
    gift.name && gift.name.trim().length > 0 ? gift.name.trim().charAt(0).toUpperCase() : "?";

  return (
    <article className="gift-card" aria-live="polite">
      <div className="gift-card__media">
        {gift.image ? (
          <img src={gift.image} alt={gift.name} className="gift-card__image" loading="lazy" />
        ) : (
          <span className="gift-card__placeholder" aria-hidden="true">
            {fallbackLetter}
          </span>
        )}
      </div>
      <div className="gift-card__content">
        <header className="gift-card__header">
          <h3 className="gift-card__title">{gift.name}</h3>
          {gift.category && (
            <span className="gift-card__category" aria-label="Category">
              {gift.category}
            </span>
          )}
        </header>
        <p className="gift-card__meta">
          <a className="gift-card__link focus-ring" href={gift.url} target="_blank" rel="noreferrer">
            View item
          </a>
          {formattedPrice && <span className="gift-card__price">{formattedPrice}</span>}
        </p>
      </div>
      <footer className="gift-card__footer">
        <span
          className={`gift-card__status gift-card__status--${gift.confirmed ? "confirmed" : "pending"}`}
        >
          {statusLabel}
        </span>
        {!gift.confirmed && (
          <button
            type="button"
            className="gift-card__confirm"
            onClick={handleConfirm}
            disabled={confirming}
            aria-pressed="false"
          >
            {confirming ? "Confirming…" : "Confirm Gift"}
          </button>
        )}
      </footer>
    </article>
  );
}
