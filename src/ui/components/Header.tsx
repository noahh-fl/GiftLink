import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import "../styles/header.css";

interface HeaderLink {
  to: string;
  label: string;
}

interface HeaderProps {
  appName?: string;
  actions?: ReactNode;
  links: HeaderLink[];
}

export default function Header({ appName = "GiftLink", actions, links }: HeaderProps) {
  return (
    <header className="app-header" role="banner">
      <a href="#main" className="app-header__skip">Skip to content</a>
      <div className="app-header__inner">
        <div className="app-header__brand" role="presentation">
          <NavLink to="/" className="app-header__brand-link" aria-label={`${appName} home`}>
            <span className="app-header__brand-name">{appName}</span>
          </NavLink>
        </div>
        <nav className="app-header__nav" aria-label="Primary">
          <ul className="app-header__nav-list">
            {links.map((link) => (
              <li key={link.to} className="app-header__nav-item">
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    ["app-header__nav-link", isActive ? "app-header__nav-link--active" : ""]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="app-header__actions">{actions}</div>
      </div>
    </header>
  );
}
