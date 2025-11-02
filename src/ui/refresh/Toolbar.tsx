import type { ReactNode } from "react";
import styles from "./Toolbar.module.css";

interface ToolbarProps {
  children: ReactNode;
  className?: string;
}

export default function Toolbar({ children, className }: ToolbarProps) {
  const toolbarClass = [styles.toolbar, className].filter(Boolean).join(" ");
  return <div className={toolbarClass}>{children}</div>;
}
