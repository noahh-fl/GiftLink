import { type ReactNode } from "react";
import styles from "./QuickRectButton.module.css";

interface QuickRectButtonProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export default function QuickRectButton({ icon, label, onClick, disabled, className }: QuickRectButtonProps) {
  const buttonClass = [styles.button, className].filter(Boolean).join(" ");
  return (
    <button
      type="button"
      className={buttonClass}
      onClick={onClick}
      disabled={disabled}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.label}>{label}</span>
    </button>
  );
}
