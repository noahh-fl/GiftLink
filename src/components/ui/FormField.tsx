import { cloneElement, isValidElement, type ReactElement } from "react";
import "../../styles/ui.css";

export type FormFieldProps = {
  id: string;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: ReactElement;
  className?: string;
};

export function FormField({
  id,
  label,
  description,
  error,
  required,
  children,
  className,
}: FormFieldProps) {
  if (!isValidElement(children)) {
    throw new Error("FormField expects a single form control as its child.");
  }

  const descriptionId = description ? `${id}-desc` : undefined;
  const errorId = error ? `${id}-err` : undefined;

  const describedByParts = [
    children.props["aria-describedby"],
    descriptionId,
    errorId,
  ].filter(Boolean);

  const describedBy = describedByParts.length
    ? describedByParts.join(" ")
    : undefined;

  const control = cloneElement(children, {
    id,
    required: children.props.required ?? required,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : children.props["aria-invalid"],
    "aria-required": required ? true : children.props["aria-required"],
  });

  const wrapperClasses = ["ui-field", className ?? ""].filter(Boolean).join(" ");

  return (
    <div className={wrapperClasses}>
      <label className="ui-field__label" htmlFor={id}>
        <span>{label}</span>
        {required && (
          <span aria-hidden="true" className="ui-field__required">
            *
          </span>
        )}
      </label>
      {control}
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
}

/*
Example:
<FormField id="join-code" label="Invite code" description="Share with your partner.">
  <input type="text" className="ui-input" />
</FormField>
*/
