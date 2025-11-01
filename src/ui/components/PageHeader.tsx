import type { ReactNode } from "react";
import "../styles/components/page-header.css";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  titleId?: string;
  description?: string;
  actions?: ReactNode;
  align?: "start" | "center" | "end";
}

export default function PageHeader({
  eyebrow,
  title,
  titleId,
  description,
  actions,
  align = "start",
}: PageHeaderProps) {
  return (
    <header className={`page-header page-header--${align}`}>
      <div className="page-header__body">
        {eyebrow ? <p className="page-header__eyebrow">{eyebrow}</p> : null}
        <h1 className="page-header__title" id={titleId}>
          {title}
        </h1>
        {description ? <p className="page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
