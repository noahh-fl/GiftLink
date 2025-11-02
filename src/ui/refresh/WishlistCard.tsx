import styles from "./WishlistCard.module.css";

interface WishlistCardProps {
  title: string;
  imageUrl?: string | null;
  pointsLabel: string;
  priceLabel?: string | null;
  notes?: string | null;
  meta?: string | null;
  actionLabel: string;
  onAction?: () => void;
  href?: string | null;
  actionType?: "button" | "link";
}

export default function WishlistCard({
  title,
  imageUrl,
  pointsLabel,
  priceLabel,
  notes,
  meta,
  actionLabel,
  onAction,
  href,
  actionType = "button",
}: WishlistCardProps) {
  const actionClass = [styles.action, actionType === "link" ? styles.linkAction : undefined]
    .filter(Boolean)
    .join(" ");

  const handleClick = () => {
    if (onAction) {
      onAction();
    }
  };

  const actionElement = actionType === "link" && href ? (
    <a className={actionClass} href={href} target="_blank" rel="noreferrer">
      {actionLabel}
    </a>
  ) : (
    <button type="button" className={actionClass} onClick={handleClick}>
      {actionLabel}
    </button>
  );

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : <div className={styles.placeholder}>No image</div>}
      </div>
      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <span className={styles.points}>{pointsLabel}</span>
        </div>
        {priceLabel ? <p className={styles.price}>{priceLabel}</p> : null}
        {notes ? <p className={styles.notes}>{notes}</p> : null}
        {meta ? <p className={styles.meta}>{meta}</p> : null}
        <div className={styles.actions}>{actionElement}</div>
      </div>
    </article>
  );
}
