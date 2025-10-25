import { forwardRef, type MouseEvent, type ButtonHTMLAttributes } from "react";
import "../../styles/ui.css";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    type = "button",
    className,
    children,
    onClick,
    ...rest
  },
  ref,
) {
  const isLoading = Boolean(loading);
  const isDisabled = Boolean(disabled) || isLoading;

  const classes = [
    "ui-btn",
    `ui-btn--${variant}`,
    `ui-btn--${size}`,
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-disabled={disabled ? true : undefined}
      aria-busy={isLoading || undefined}
      data-loading={isLoading ? "true" : undefined}
      onClick={handleClick}
    >
      {isLoading && <span className="ui-btn__spinner" aria-hidden="true" />}
      <span className="ui-btn__label">{children}</span>
    </button>
  );
});

/*
Example:
<Button variant="secondary" size="lg">Review wishlist</Button>
*/
