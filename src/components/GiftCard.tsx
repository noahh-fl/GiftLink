import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import type { Gift } from "../types/gift";

interface GiftCardProps {
  gift: Gift;
  onConfirm: (giftId: number) => Promise<void>;
}

type InteractionState = "idle" | "hover" | "active";

const BORDER_WIDTH = "calc(var(--space-1) / 4)";

const cardStyles: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "calc(var(--space-12) * 2) 1fr",
  gap: "var(--space-4)",
  alignItems: "stretch",
};

const mediaStyles: CSSProperties = {
  width: "100%",
  borderRadius: "var(--radius-md)",
  border: `${BORDER_WIDTH} dashed var(--color-border)`,
  background: "var(--color-bg)",
  overflow: "hidden",
  aspectRatio: "1 / 1",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const contentStyles: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
};

const headerStyles: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "var(--space-2)",
};

const categoryStyles: CSSProperties = {
  background: "var(--color-accent-quiet)",
  color: "var(--color-accent)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-1) var(--space-2)",
  fontSize: "var(--caption-size)",
  fontWeight: "var(--caption-weight)",
};

const metaRowStyles: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-3)",
  alignItems: "center",
  color: "var(--color-text-muted)",
};

const footerStyles: CSSProperties = {
  gridColumn: "1 / -1",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
  borderTop: `${BORDER_WIDTH} solid var(--color-border)`,
  paddingTop: "var(--space-3)",
};

const statusStyles = (confirmed: boolean): CSSProperties => ({
  fontSize: "var(--caption-size)",
  fontWeight: "var(--caption-weight)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: confirmed ? "var(--color-success)" : "var(--color-text-muted)",
});

export function GiftCard({ gift, onConfirm }: GiftCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [interaction, setInteraction] = useState<InteractionState>("idle");
  const isInteractiveButton = !(gift.confirmed || confirming);

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

  const fallbackLetter =
    gift.name && gift.name.trim()
      ? gift.name.trim().charAt(0).toUpperCase()
      : "?";

  const statusLabel = gift.confirmed ? "Confirmed" : "Awaiting confirmation";

  useEffect(() => {
    if (gift.confirmed) {
      setInteraction("idle");
    }
  }, [gift.confirmed]);

  async function handleConfirm() {
    if (gift.confirmed || confirming) return;
    setInlineError(null);
    setConfirming(true);

    try {
      await onConfirm(gift.id);
      setInteraction("idle");
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Unable to confirm gift.";
      setInlineError(message);
    } finally {
      setConfirming(false);
    }
  }

  const buttonStyle: CSSProperties = {
    background: gift.confirmed
      ? "var(--color-accent-quiet)"
      : "var(--color-accent)",
    color: gift.confirmed ? "var(--color-accent)" : "var(--color-surface)",
    border: "none",
    borderRadius: "var(--radius-md)",
    padding: "0 var(--space-5)",
    minHeight: "var(--space-12)",
    fontSize: "var(--body-size)",
    fontWeight: "var(--h3-weight)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: gift.confirmed ? "default" : confirming ? "wait" : "pointer",
    opacity: gift.confirmed ? 0.7 : confirming ? 0.85 : 1,
    boxShadow:
      isInteractiveButton && interaction !== "idle" ? "var(--elev-1)" : "none",
    transform:
      isInteractiveButton && interaction === "active"
        ? "scale(0.98)"
        : "scale(1)",
    transition:
      "box-shadow var(--dur-med) var(--ease), transform var(--dur-fast) var(--ease), background var(--dur-med) var(--ease)",
  };

  const linkStyles: CSSProperties = {
    fontWeight: "var(--h3-weight)",
    color: "var(--color-accent)",
    textDecoration: "none",
    borderRadius: "var(--radius-sm)",
  };

  const placeholderStyles: CSSProperties = {
    fontSize: "var(--h2-size)",
    fontWeight: "var(--h2-weight)",
    color: "var(--color-text-muted)",
  };

  return (
    <article className="card" style={cardStyles} aria-live="polite">
      <div style={mediaStyles}>
        {gift.image ? (
          <img
            src={gift.image}
            alt={gift.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy"
          />
        ) : (
          <span style={placeholderStyles} aria-hidden="true">
            {fallbackLetter}
          </span>
        )}
      </div>

      <div style={contentStyles}>
        <header style={headerStyles}>
          <h3 style={{ margin: 0 }}>{gift.name}</h3>
          {gift.category && (
            <span style={categoryStyles} aria-label="Category">
              {gift.category}
            </span>
          )}
        </header>

        <div style={metaRowStyles}>
          <a
            href={gift.url}
            target="_blank"
            rel="noreferrer"
            className="focus-ring"
            style={linkStyles}
          >
            View item
          </a>
          {formattedPrice && (
            <span
              style={{ fontWeight: "var(--h3-weight)", color: "var(--color-text)" }}
            >
              {formattedPrice}
            </span>
          )}
        </div>
      </div>

      <footer style={footerStyles}>
        <span style={statusStyles(gift.confirmed)} role="status">
          {statusLabel}
        </span>

        <button
          type="button"
          className="focus-ring"
          onClick={handleConfirm}
          disabled={gift.confirmed || confirming}
          aria-busy={confirming}
          style={buttonStyle}
          onPointerEnter={() => {
            if (isInteractiveButton) setInteraction("hover");
          }}
          onPointerLeave={() => setInteraction("idle")}
          onPointerDown={() => {
            if (isInteractiveButton) setInteraction("active");
          }}
          onPointerUp={() => {
            if (isInteractiveButton) setInteraction("hover");
          }}
          onFocus={() => {
            if (isInteractiveButton) setInteraction("hover");
          }}
          onBlur={() => setInteraction("idle")}
          onKeyDown={(event) => {
            if (event.key === " " || event.key === "Enter") {
              if (isInteractiveButton) setInteraction("active");
            }
          }}
          onKeyUp={(event) => {
            if (event.key === " " || event.key === "Enter") {
              if (isInteractiveButton) setInteraction("hover");
            }
          }}
        >
          {gift.confirmed
            ? "Confirmed"
            : confirming
              ? "Confirming..."
              : "Confirm received"}
        </button>

        {inlineError && (
          <span
            role="alert"
            aria-live="assertive"
            style={{
              fontSize: "var(--caption-size)",
              color: "var(--color-danger)",
            }}
          >
            {inlineError}
          </span>
        )}
      </footer>
    </article>
  );
}
