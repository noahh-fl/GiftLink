import { cloneElement, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import "../styles/components/form-field.css";

interface FormFieldProps {
  label: ReactNode;
  htmlFor: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactElement<Record<string, unknown>>;
}

export default function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: FormFieldProps) {
  const describedBy = [hint ? `${htmlFor}-hint` : null, error ? `${htmlFor}-error` : null]
    .filter(Boolean)
    .join(" ");

  const childProps = children.props ?? {};
  const childRequired = typeof childProps.required === "boolean" ? childProps.required : undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: htmlFor,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : undefined,
        required: required ?? childRequired,
      } as Record<string, unknown>)
    : children;

  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden="true">*</span> : null}
      </label>
      <div className="form-field__control">{control}</div>
      {hint ? (
        <p id={`${htmlFor}-hint`} className="form-field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
