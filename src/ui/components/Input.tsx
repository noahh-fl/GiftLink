import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import "../styles/components/input.css";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ hasError, className = "", ...props }, ref) => {
  const classes = ["input", hasError ? "input--error" : "", className].filter(Boolean).join(" ");
  return <input ref={ref} className={classes} {...props} />;
});

Input.displayName = "Input";

export default Input;
