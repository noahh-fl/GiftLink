import type { ReactNode } from "react";
import "../styles/components/card.css";

interface CardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  padding?: "sm" | "md" | "lg";
  role?: string;
}

export default function Card({ title, action, children, padding = "md", role }: CardProps) {
  return (
    <section className={`gl-card gl-card--${padding}`} role={role}>
      {(title || action) && (
        <header className="gl-card__header">
          {title && <h2 className="gl-card__title">{title}</h2>}
          {action && <div className="gl-card__action">{action}</div>}
        </header>
      )}
      <div className="gl-card__body">{children}</div>
    </section>
  );
}
