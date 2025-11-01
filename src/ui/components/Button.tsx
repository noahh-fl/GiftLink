import type { ButtonHTMLAttributes, ReactNode } from "react";
import "../styles/components/button.css";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export default function Button({
  variant = "primary",
  isLoading = false,
  icon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const classes = [
    "button",
    variant ? `button--${variant}` : "",
    isLoading ? "button--loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <span className="button__label">
      {icon ? <span className="button__icon" aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
    </span>
  );

  return (
    <button className={classes} disabled={disabled || isLoading} data-variant={variant} {...props}>
      {isLoading ? (
        <span className="button__spinner" aria-hidden="true" />
      ) : null}
      {content}
    </button>
  );
}
