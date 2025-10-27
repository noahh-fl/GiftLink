import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../ui/components/Button";
import Card from "../../ui/components/Card";
import { useSpace } from "../../contexts/SpaceContext";
import { formatCurrency, formatDateTime } from "../../utils/format";
import "../../ui/styles/pages/gift.css";

export default function GiftDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const giftId = Number(id);
  const { gifts, reserveGift, moveGiftToStatus, confirmGiftReceipt } = useSpace();
  const gift = gifts.find((item) => item.id === giftId);

  const nextAction = useMemo(() => {
    if (!gift) return null;
    switch (gift.status) {
      case "wanted":
        return {
          label: "Reserve this gift",
          action: () => reserveGift(gift.id, "You"),
          variant: "primary" as const,
        };
      case "reserved":
        return {
          label: "Mark as purchased",
          action: () => moveGiftToStatus(gift.id, "purchased", "You"),
          variant: "primary" as const,
        };
      case "purchased":
        return {
          label: "Mark as delivered",
          action: () => moveGiftToStatus(gift.id, "delivered", "You"),
          variant: "primary" as const,
        };
      case "delivered":
        return {
          label: "Confirm received",
          action: () => confirmGiftReceipt(gift.id),
          variant: "primary" as const,
          tone: "success" as const,
        };
      default:
        return null;
    }
  }, [gift, confirmGiftReceipt, moveGiftToStatus, reserveGift]);

  if (!gift) {
    return (
      <div className="gift-detail">
        <Card title="Gift not found">
          <p>This gift may have been archived or removed.</p>
          <Button asChild variant="secondary">
            <Link to="/wishlist">Back to wishlist</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="gift-detail">
      <header className="gift-detail__header">
        <div>
          <h1>{gift.name}</h1>
          <p className="gift-detail__subtitle">Track the journey from idea → surprise → celebration.</p>
        </div>
        {nextAction && (
          <Button variant={nextAction.variant} tone={nextAction.tone} onClick={nextAction.action}>
            {nextAction.label}
          </Button>
        )}
      </header>
      <div className="gift-detail__grid">
        <Card title="Overview" padding="lg">
          <dl className="gift-detail__meta">
            <div>
              <dt>Price</dt>
              <dd>{formatCurrency(gift.price)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{gift.status.toUpperCase()}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{gift.priority.toUpperCase()}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{gift.category ?? "—"}</dd>
            </div>
          </dl>
          <div className="gift-detail__links">
            <Button variant="ghost" asChild>
              <a href={gift.url} target="_blank" rel="noreferrer">
                Open product link
              </a>
            </Button>
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Go back
            </Button>
          </div>
        </Card>

        <Card title="Timeline" padding="lg">
          <ol className="gift-detail__timeline">
            {gift.timeline.map((entry) => (
              <li key={entry.id} className="gift-detail__timeline-item">
                <div className="gift-detail__timeline-marker" aria-hidden="true" />
                <div className="gift-detail__timeline-content">
                  <span className="gift-detail__timeline-label">{entry.label}</span>
                  {entry.description && <p className="gift-detail__timeline-description">{entry.description}</p>}
                  <time className="gift-detail__timeline-time">{formatDateTime(entry.timestamp)}</time>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
