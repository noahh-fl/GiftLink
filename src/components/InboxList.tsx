import "./InboxList.css";

type ActivityType = "wishlist_add" | "reward_add" | "reward_edit" | "reward_redeem";

export interface InboxItem {
  id: number;
  type: ActivityType;
  actor: string;
  createdAt: string;
  payload?: Record<string, unknown> | null;
}

interface InboxListProps {
  items: InboxItem[];
  currentUserId: string;
}

const TYPE_LABELS: Record<ActivityType, string> = {
  wishlist_add: "added to Wishlist",
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
  const action = TYPE_LABELS[item.type] ?? "updated";
  const payloadTitle = typeof item.payload?.title === "string" ? item.payload.title : undefined;
  const points = typeof item.payload?.points === "number" ? `${item.payload.points} pts` : undefined;

  switch (item.type) {
    case "wishlist_add":
      return payloadTitle ? `${actorLabel} added ${payloadTitle}` : `${actorLabel} ${action}`;
    case "reward_add":
    case "reward_edit":
      return payloadTitle ? `${actorLabel} ${action} ${payloadTitle}` : `${actorLabel} ${action}`;
    case "reward_redeem":
      return payloadTitle
        ? `${actorLabel} redeemed ${payloadTitle}${points ? ` (${points})` : ""}`
        : `${actorLabel} redeemed a reward`;
    default:
      return `${actorLabel} ${action}`;
  }
}

export default function InboxList({ items, currentUserId }: InboxListProps) {
  if (items.length === 0) {
    return <p className="inbox-list__empty">No activity yet. Add wishlist items or rewards to start.</p>;
  }

  return (
    <ul className="inbox-list" role="list">
      {items.map((item) => (
        <li key={item.id} className="inbox-list__item">
          <div className="inbox-list__marker" aria-hidden="true" />
          <div className="inbox-list__content">
            <p className="inbox-list__title">{resolveTitle(item, currentUserId)}</p>
            <p className="inbox-list__meta">{formatRelative(item.createdAt)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
