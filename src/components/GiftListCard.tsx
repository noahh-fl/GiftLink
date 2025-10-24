import { type CSSProperties } from "react";
import { Link } from "react-router-dom";

interface GiftListCardProps {
  spaceId: string;
  spaceName: string;
  giftCount: number;
  onAddGift: () => void;
}

const cardStyle: CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-5)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
  minHeight: "calc(var(--space-12) * 5)",
};

const primaryButtonStyle: CSSProperties = {
  background: "var(--color-accent)",
  color: "var(--color-surface)",
  border: "none",
  borderRadius: "var(--radius-md)",
  padding: "0 var(--space-5)",
  minHeight: "var(--space-12)",
  fontSize: "var(--body-size)",
  fontWeight: "var(--h3-weight)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background var(--dur-med) var(--ease), transform var(--dur-fast) var(--ease)",
};

const secondaryButtonStyle: CSSProperties = {
  background: "var(--color-accent-quiet)",
  color: "var(--color-accent)",
  border: "none",
  borderRadius: "var(--radius-md)",
  padding: "0 var(--space-5)",
  minHeight: "var(--space-12)",
  fontSize: "var(--body-size)",
  fontWeight: "var(--h3-weight)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background var(--dur-med) var(--ease)",
};

export default function GiftListCard({
  giftCount,
  onAddGift,
  spaceId,
  spaceName,
}: GiftListCardProps) {
  const hasGifts = giftCount > 0;

  return (
    <section style={cardStyle} aria-label="Gift summary">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--space-3)",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Gifts</h2>
          <p
            style={{
              margin: 0,
              marginTop: "var(--space-1)",
              color: "var(--color-text-muted)",
            }}
          >
            {giftCount} {giftCount === 1 ? "gift" : "gifts"}
          </p>
        </div>
        <Link
          to={`/space/${spaceId}/gifts`}
          aria-label={`View gifts for ${spaceName}`}
          className="focus-ring"
          style={{
            ...secondaryButtonStyle,
            textDecoration: "none",
            fontWeight: "var(--h3-weight)",
          }}
        >
          View gifts
        </Link>
      </div>

      {hasGifts ? (
        <p
          style={{
            margin: 0,
            color: "var(--color-text)",
            lineHeight: 1.5,
          }}
        >
          You're on track! Keep the list curated so members know exactly what
          {" "}
          {spaceName} is hoping for.
        </p>
      ) : (
        <p
          style={{
            margin: 0,
            color: "var(--color-text-muted)",
            lineHeight: 1.5,
          }}
        >
          No gifts yet. Add the first idea so your space has a clear starting
          point.
        </p>
      )}

      <div style={{ marginTop: "auto" }}>
        <button
          type="button"
          onClick={onAddGift}
          className="focus-ring"
          style={primaryButtonStyle}
          aria-label="Add a gift"
        >
          Add gift
        </button>
      </div>
    </section>
  );
}
