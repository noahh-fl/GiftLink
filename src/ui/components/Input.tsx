import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";
import "../styles/components/input.css";

type NativeInputProps = InputHTMLAttributes<HTMLInputElement>;

interface InputProps extends NativeInputProps {
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ fullWidth = true, className = "", ...props }, ref) => {
  const composed = ["gl-input", fullWidth ? "gl-input--block" : "", className].filter(Boolean).join(" ");
  return <input ref={ref} className={composed} {...props} />;
});

Input.displayName = "Input";

export default Input;
