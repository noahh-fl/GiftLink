import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type HTMLInputTypeAttribute,
} from "react";
import "../../styles/ui.css";

export type InputProps = {
  label?: string;
  description?: string;
  error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  type?: HTMLInputTypeAttribute;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id,
    label,
    description,
    error,
    type = "text",
    required,
    disabled,
    className,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-desc` : undefined;
  const errorId = error ? `${inputId}-err` : undefined;

  const { ["aria-describedby"]: ariaDescribedBy, ...inputProps } = rest;

  const describedBy =
    [ariaDescribedBy, descriptionId, errorId].filter(Boolean).join(" ") ||
    undefined;

  const inputClasses = ["ui-input", error ? "ui-input--error" : ""]
    .filter(Boolean)
    .join(" ");

  const fieldClasses = ["ui-field", className ?? ""].filter(Boolean).join(" ");

  return (
    <div className={fieldClasses}>
      {label && (
        <label className="ui-field__label" htmlFor={inputId}>
          <span>{label}</span>
          {required && (
            <span aria-hidden="true" className="ui-field__required">
              *
            </span>
          )}
        </label>
      )}
      <input
        {...inputProps}
        ref={ref}
        id={inputId}
        type={type}
        className={inputClasses}
        required={required}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
      />
      {description && (
        <p id={descriptionId} className="ui-field__description">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="ui-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

/*
Example:
<Input label="Gift name" placeholder="Wireless headphones" required />
*/
