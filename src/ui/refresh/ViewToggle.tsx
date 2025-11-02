import styles from "./ViewToggle.module.css";

type ViewOption = "grid" | "list";

interface ViewToggleProps {
  value: ViewOption;
  onChange: (next: ViewOption) => void;
}

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className={styles.toggle} role="group" aria-label="Change wishlist view">
      <button
        type="button"
        className={[styles.button, value === "grid" ? styles.active : undefined].filter(Boolean).join(" ")}
        onClick={() => onChange("grid")}
        aria-pressed={value === "grid"}
      >
        Cards
      </button>
      <button
        type="button"
        className={[styles.button, value === "list" ? styles.active : undefined].filter(Boolean).join(" ")}
        onClick={() => onChange("list")}
        aria-pressed={value === "list"}
      >
        List
      </button>
    </div>
  );
}

export type { ViewOption };
