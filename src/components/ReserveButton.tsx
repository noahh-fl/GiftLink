import { useMemo, useState, type CSSProperties } from "react";

type InteractionState = "idle" | "hover" | "active";

export interface ReserveButtonProps {
  reserved: boolean;
  loading?: boolean;
  disabled?: boolean;
  onReserve: () => Promise<void> | void;
  onUnreserve: () => Promise<void> | void;
}

const BORDER_WIDTH = "calc(var(--space-1) / 4)";

export function ReserveButton({
  reserved,
  loading = false,
  disabled = false,
  onReserve,
  onUnreserve,
}: ReserveButtonProps) {
  const [interaction, setInteraction] = useState<InteractionState>("idle");
  const isInteractive = !(disabled || loading);

  const labels = useMemo(() => {
    if (loading) {
      return reserved ? "Releasing..." : "Reserving...";
    }
    return reserved ? "Unreserve gift" : "Reserve this gift";
  }, [loading, reserved]);

  const visualLayer: CSSProperties = reserved
    ? {
        background: "var(--color-surface)",
        color: "var(--color-text)",
        border: `${BORDER_WIDTH} solid var(--color-border)`,
      }
    : {
        background: "var(--color-accent)",
        color: "var(--color-surface)",
        border: "none",
      };

  const buttonStyles: CSSProperties = {
    ...visualLayer,
    borderRadius: "var(--radius-lg)",
    padding: "0 var(--space-6)",
    minHeight: "var(--space-12)",
    width: "100%",
    fontSize: "var(--body-size)",
    fontWeight: "var(--h3-weight)",
    lineHeight: 1.1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-2)",
    cursor: isInteractive ? "pointer" : loading ? "wait" : "not-allowed",
    opacity: isInteractive ? 1 : 0.7,
    boxShadow:
      isInteractive && interaction !== "idle" ? "var(--elev-1)" : "none",
    transform:
      isInteractive && interaction === "active"
        ? "scale(0.98)"
        : "scale(1)",
    transition:
      "background var(--dur-med) var(--ease), color var(--dur-med) var(--ease), box-shadow var(--dur-med) var(--ease), transform var(--dur-fast) var(--ease)",
  };

  async function handleClick() {
    if (!isInteractive) return;
    if (reserved) {
      await onUnreserve();
      return;
    }
    await onReserve();
  }

  return (
    <button
      type="button"
      className="focus-ring"
      aria-pressed={reserved}
      aria-busy={loading}
      disabled={!isInteractive}
      style={buttonStyles}
      onClick={handleClick}
      onPointerEnter={() => {
        if (isInteractive) setInteraction("hover");
      }}
      onPointerLeave={() => setInteraction("idle")}
      onPointerDown={() => {
        if (isInteractive) setInteraction("active");
      }}
      onPointerUp={() => {
        if (isInteractive) setInteraction("hover");
      }}
      onFocus={() => {
        if (isInteractive) setInteraction("hover");
      }}
      onBlur={() => setInteraction("idle")}
      onKeyDown={(event) => {
        if ((event.key === " " || event.key === "Enter") && isInteractive) {
          setInteraction("active");
        }
      }}
      onKeyUp={(event) => {
        if ((event.key === " " || event.key === "Enter") && isInteractive) {
          setInteraction("hover");
        }
      }}
    >
      {labels}
    </button>
  );
}

export default ReserveButton;
