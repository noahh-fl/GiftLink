import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface HeaderProps {
  appName?: string;
  actions?: ReactNode;
}

export default function Header({ appName = "GiftLink", actions }: HeaderProps) {
  return (
    <header className="app-header" role="banner">
      <div className="app-header__inner">
        <div className="app-header__brand">
          <Link to="/" className="app-header__brand-link" aria-label={`${appName} home`}>
            <span className="app-header__brand-name">{appName}</span>
          </Link>
        </div>
        <div className="app-header__actions">{actions}</div>
      </div>
    </header>
  );
}
