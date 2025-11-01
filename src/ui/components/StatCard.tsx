import type { HTMLAttributes, ReactNode } from "react";
import "../styles/components/stat-card.css";

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function StatCard({ label, actions, children, className = "", ...props }: StatCardProps) {
  const classes = ["stat-card", className].filter(Boolean).join(" ");

  return (
    <div className={classes} role="group" {...props}>
      <div className="stat-card__header">
        <p className="stat-card__label">{label}</p>
        {actions ? <div className="stat-card__actions">{actions}</div> : null}
      </div>
      <div className="stat-card__content">{children}</div>
    </div>
  );
}
