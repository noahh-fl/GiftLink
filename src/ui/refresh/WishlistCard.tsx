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
  deleteLabel?: string;
  onDelete?: () => void;
  deleteButtonRef?: (node: HTMLButtonElement | null) => void;
  deleteDisabled?: boolean;
  selected?: boolean;
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
  deleteLabel,
  onDelete,
  deleteButtonRef,
  deleteDisabled = false,
  selected = false,
}: WishlistCardProps) {
  const actionClass = [styles.action, actionType === "link" ? styles.linkAction : undefined]
    .filter(Boolean)
    .join(" ");

  const cardClass = [styles.card, selected ? styles.selected : undefined].filter(Boolean).join(" ");

  const handleClick = () => {
    if (onAction) {
      onAction();
    }
  };

  const handleDelete = () => {
    if (deleteDisabled) {
      return;
    }
    if (onDelete) {
      onDelete();
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

  const deleteButton = onDelete ? (
    <button
      type="button"
      className={styles.deleteButton}
      onClick={handleDelete}
      aria-label={deleteLabel ?? "Delete item"}
      ref={deleteButtonRef}
      disabled={deleteDisabled}
    >
      Delete
    </button>
  ) : null;

  return (
    <article className={cardClass}>
      <div className={styles.media}>
        {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : <div className={styles.placeholder}>No image</div>}
      </div>
      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <div className={styles.headerActions}>
            <span className={styles.points}>{pointsLabel}</span>
            {deleteButton}
          </div>
        </div>
        {priceLabel ? <p className={styles.price}>{priceLabel}</p> : null}
        {notes ? <p className={styles.notes}>{notes}</p> : null}
        {meta ? <p className={styles.meta}>{meta}</p> : null}
        <div className={styles.actions}>{actionElement}</div>
      </div>
    </article>
  );
}
