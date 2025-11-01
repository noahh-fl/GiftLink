import type { ButtonHTMLAttributes, ReactNode } from "react";
import "../styles/components/quick-action-button.css";

interface QuickActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
}

export default function QuickActionButton({ icon, label, className = "", type = "button", ...props }: QuickActionButtonProps) {
  const classes = ["quick-action-button", className].filter(Boolean).join(" ");

  return (
    <button type={type} className={classes} {...props}>
      <span className="quick-action-button__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="quick-action-button__label">{label}</span>
    </button>
  );
}
