import type { InboxItem } from "../../components/InboxList";
import styles from "./ActivityList.module.css";

interface ActivityListProps {
  items: InboxItem[];
  currentUserId: string;
  className?: string;
}

const TYPE_LABELS: Record<InboxItem["type"], string> = {
  wishlist_add: "added to wishlist",
  reward_add: "added reward",
  reward_edit: "updated reward",
  reward_redeem: "redeemed reward",
};

function formatRelative(dateIso: string): string {
  const date = new Date(dateIso);
  if (!Number.isFinite(date.getTime())) {
    return "Recently";
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) {
    return "Just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr${diffHours > 1 ? "s" : ""} ago`;
  }
  return date.toLocaleDateString();
}

function resolveTitle(item: InboxItem, you: string): string {
  const actorLabel = item.actor === you ? "You" : item.actor;
  const payloadTitle = typeof item.payload?.title === "string" ? item.payload.title : undefined;
  const points = typeof item.payload?.points === "number" ? item.payload.points : undefined;
  const action = TYPE_LABELS[item.type] ?? "updated";

  switch (item.type) {
    case "wishlist_add":
      return payloadTitle ? `${actorLabel} added ${payloadTitle}` : `${actorLabel} ${action}`;
    case "reward_add":
    case "reward_edit":
      return payloadTitle ? `${actorLabel} ${action} ${payloadTitle}` : `${actorLabel} ${action}`;
    case "reward_redeem":
      return payloadTitle
        ? `${actorLabel} redeemed ${payloadTitle}${
            typeof points === "number" ? ` (${points} pts)` : ""
          }`
        : `${actorLabel} redeemed a reward`;
    default:
      return `${actorLabel} ${action}`;
  }
}

export default function ActivityList({ items, currentUserId, className }: ActivityListProps) {
  if (items.length === 0) {
    return <p className={styles.empty}>No activity yet. Once things pick up, updates appear here.</p>;
  }

  const listClass = [styles.list, className].filter(Boolean).join(" ");
  return (
    <ul className={listClass} role="list">
      {items.map((item) => (
        <li key={item.id} className={styles.item}>
          <span className={styles.marker} aria-hidden="true" />
          <div className={styles.content}>
            <p className={styles.title}>{resolveTitle(item, currentUserId)}</p>
            <p className={styles.meta}>{formatRelative(item.createdAt)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
