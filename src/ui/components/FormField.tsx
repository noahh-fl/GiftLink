import type { ReactNode } from "react";
import "../styles/components/form-field.css";

interface FormFieldProps {
  label: string;
  htmlFor: string;
  description?: string;
  error?: string;
  children: ReactNode;
  optional?: boolean;
}

export default function FormField({ label, htmlFor, description, error, children, optional = false }: FormFieldProps) {
  return (
    <div className="gl-form-field">
      <label className="gl-form-field__label" htmlFor={htmlFor}>
        <span>{label}</span>
        {optional && <span className="gl-form-field__optional">Optional</span>}
      </label>
      {description && (
        <p id={`${htmlFor}-desc`} className="gl-form-field__description">
          {description}
        </p>
      )}
      <div className="gl-form-field__control">{children}</div>
      {error && (
        <p role="alert" className="gl-form-field__error" id={`${htmlFor}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
