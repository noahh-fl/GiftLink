import styles from "./JoinCodePill.module.css";

type CopyState = "idle" | "copied" | "error";

interface JoinCodePillProps {
  code?: string;
  label?: string;
  onCopy?: () => void;
  copyState?: CopyState;
  className?: string;
}

export default function JoinCodePill({
  code,
  label = "Join code",
  onCopy,
  copyState = "idle",
  className,
}: JoinCodePillProps) {
  const pillClass = [styles.pill, className].filter(Boolean).join(" ");
  const copyFeedback =
    copyState === "copied"
      ? "Copied"
      : copyState === "error"
        ? "Copy unavailable"
        : null;

  return (
    <div className={pillClass}>
      <div className={styles.meta}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value} aria-live="polite">
          {code || "—"}
        </span>
      </div>
      <button
        type="button"
        className={styles.copyButton}
        onClick={onCopy}
        disabled={!code || !onCopy}
      >
        Copy
      </button>
      {copyFeedback ? (
        <span className={styles.feedback} role="status">
          {copyFeedback}
        </span>
      ) : null}
    </div>
  );
}
