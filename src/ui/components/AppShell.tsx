import type { ReactNode } from "react";
import Header from "./Header";
import "../styles/app-shell.css";

interface AppShellProps {
  children: ReactNode;
  navigation?: ReactNode;
  headerActions?: ReactNode;
}

export default function AppShell({ children, navigation, headerActions }: AppShellProps) {
  return (
    <div className="app-shell">
      <Header navigation={navigation} actions={headerActions} />
      <main className="app-shell__main">
        <div className="app-shell__content">{children}</div>
      </main>
    </div>
  );
}
