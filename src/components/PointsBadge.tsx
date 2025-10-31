import "./PointsBadge.css";

interface PointsBadgeProps {
  label: string;
  ariaLabel?: string;
  className?: string;
}

export default function PointsBadge({ label, ariaLabel, className }: PointsBadgeProps) {
  const ariaProps = ariaLabel ? { "aria-label": ariaLabel } : {};
  const classes = ["points-badge", className].filter(Boolean).join(" ");

  return (
    <span className={classes} {...ariaProps}>
      <span className="points-badge__icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" focusable="false">
          <circle cx="10" cy="10" r="9" fill="var(--color-gold-soft)" />
          <circle cx="10" cy="10" r="8" stroke="var(--color-gold-500)" strokeWidth="1.5" fill="none" />
          <path
            d="M10 5.5c1.933 0 3.5 1.343 3.5 3s-1.567 3-3.5 3h-.75v1.75h1.75a.75.75 0 1 1 0 1.5h-1.75V15a.75.75 0 0 1-1.5 0v-1.25H8a.75.75 0 0 1 0-1.5h.5V11H8a.75.75 0 0 1 0-1.5h.5V8.5C8.5 6.843 9.067 5.5 11 5.5Zm0 1.5c-1.107 0-1.5.633-1.5 1.5V9.5H10c1.107 0 2-.633 2-1.5s-.893-1.5-2-1.5Z"
            fill="var(--color-gold-600)"
          />
        </svg>
      </span>
      <span className="points-badge__text">{label}</span>
    </span>
  );
}
