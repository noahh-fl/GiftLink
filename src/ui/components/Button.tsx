import type { ButtonHTMLAttributes, ReactNode } from "react";
import "../styles/components/button.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  children: ReactNode;
}

export default function Button({ variant = "primary", children, className = "", ...props }: ButtonProps) {
  const classes = ["button", variant === "secondary" ? "button--secondary" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
