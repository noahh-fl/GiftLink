import type { ButtonHTMLAttributes, ReactElement } from "react";
import { cloneElement, forwardRef, isValidElement } from "react";
import "../styles/components/button.css";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonTone = "default" | "danger" | "success";

type NativeButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;
type AsChildProps = {
  className?: string;
  tabIndex?: number;
  'aria-disabled'?: boolean;
  [key: string]: unknown;
};


interface ButtonProps extends NativeButtonProps {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      tone = "default",
      size = "md",
      loading = false,
      disabled,
      children,
      className = "",
      asChild = false,
      ...rest
    },
    ref,
  ) => {
    const composedClass = [
      "gl-button",
      `gl-button--${variant}`,
      `gl-button--${size}`,
      tone !== "default" ? `gl-button--${tone}` : "",
      loading ? "gl-button--loading" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    if (asChild && isValidElement(children)) {
      const element = children as ReactElement<AsChildProps>;
      const mergedClassName = [element.props.className, composedClass].filter(Boolean).join(" ");
      return cloneElement(element, {
        className: mergedClassName,
        'aria-disabled': disabled || loading ? true : element.props['aria-disabled'],
        tabIndex: disabled || loading ? -1 : element.props.tabIndex,
      });
    }

    return (
      <button
        ref={ref}
        className={composedClass}
        disabled={disabled || loading}
        data-variant={variant}
        data-tone={tone}
        {...rest}
      >
        <span className="gl-button__content" aria-live="polite" aria-busy={loading}>
          {loading ? "Working…" : children}
        </span>
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
