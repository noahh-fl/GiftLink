import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface HeaderProps {
  appName?: string;
  navigation?: ReactNode;
  actions?: ReactNode;
}

export default function Header({ appName = "GiftLink", navigation, actions }: HeaderProps) {
  return (
    <header className="app-header" role="banner">
      <div className="app-header__inner">
        <div className="app-header__brand">
          <Link to="/" className="app-header__brand-link" aria-label={`${appName} home`}>
            <span className="app-header__brand-name">{appName}</span>
          </Link>
        </div>
        {navigation ? (
          <nav className="app-header__nav" aria-label="Main">
            {navigation}
          </nav>
        ) : null}
        {actions ? <div className="app-header__actions">{actions}</div> : null}
      </div>
    </header>
  );
}
