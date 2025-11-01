import PointsBadge from "./PointsBadge";
import "./GiftCard.css";

interface GiftCardProps {
  title: string;
  image?: string | null;
  priceLabel?: string | null;
  pointsLabel?: string | null;
  notes?: string | null;
  meta?: string | null;
  viewHref?: string | null;
  onView?: () => void;
}

export default function GiftCard({
  title,
  image,
  priceLabel,
  pointsLabel,
  notes,
  meta,
  viewHref,
  onView,
}: GiftCardProps) {
  const hasImage = Boolean(image);
  const viewIsLink = typeof viewHref === "string" && viewHref.length > 0;

  return (
    <article className="gift-card">
      <div className="gift-card__media" aria-hidden={!hasImage}>
        {hasImage ? (
          <img src={image ?? ""} alt="" loading="lazy" />
        ) : (
          <div className="gift-card__placeholder">No image</div>
        )}
      </div>
      <div className="gift-card__body">
        <header className="gift-card__header">
          <h2 className="gift-card__title" title={title}>
            {title}
          </h2>
          <div className="gift-card__meta" aria-live="polite">
            {priceLabel ? <p className="gift-card__price">{priceLabel}</p> : null}
            {pointsLabel ? (
              <PointsBadge className="gift-card__badge" label={pointsLabel} ariaLabel={pointsLabel} />
            ) : null}
          </div>
        </header>
        {notes ? <p className="gift-card__notes">{notes}</p> : null}
        {meta ? <p className="gift-card__footnote">{meta}</p> : null}
        {viewIsLink || onView ? (
          <div className="gift-card__actions">
            {viewIsLink ? (
              <a className="gift-card__link" href={viewHref ?? undefined} target="_blank" rel="noreferrer">
                View
              </a>
            ) : null}
            {!viewIsLink && onView ? (
              <button type="button" className="gift-card__link" onClick={onView}>
                View
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
