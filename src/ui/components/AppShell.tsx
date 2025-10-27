import type { ReactNode } from "react";
import Header from "./Header";
import ToastRegion from "./ToastRegion";
import "../styles/app-shell.css";

interface NavLinkItem {
  to: string;
  label: string;
}

interface AppShellProps {
  children: ReactNode;
  headerActions?: ReactNode;
  navLinks: NavLinkItem[];
}

export default function AppShell({ children, headerActions, navLinks }: AppShellProps) {
  return (
    <div className="app-shell">
      <Header links={navLinks} actions={headerActions} />
      <main id="main" className="app-shell__main" tabIndex={-1} role="main">
        <div className="app-shell__content">{children}</div>
      </main>
      <ToastRegion />
    </div>
  );
}
