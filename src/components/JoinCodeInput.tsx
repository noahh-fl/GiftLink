import type { ChangeEvent } from "react";
import { useId, useState } from "react";

export const JOIN_CODE_MIN = 6;
export const JOIN_CODE_MAX = 10;

export interface JoinCodeValidationResult {
  cleaned: string;
  isValid: boolean;
  message: string;
}

export function normalizeJoinCodeInput(raw: string): string {
  if (!raw) {
    return "";
  }

  const upper = raw.toUpperCase();
  let normalized = "";
  let hyphenCount = 0;

  for (const char of upper) {
    if (char === "-") {
      if (hyphenCount > 0) {
        continue;
      }
      hyphenCount += 1;
    } else if (!/[A-Z0-9]/.test(char)) {
      continue;
    }

    if ((normalized + char).length > JOIN_CODE_MAX) {
      break;
    }

    normalized += char;
  }

  return normalized;
}

export function validateJoinCode(raw: string): JoinCodeValidationResult {
  const cleaned = raw.trim().toUpperCase();

  if (!cleaned) {
    return {
      cleaned: "",
      isValid: false,
      message: "Enter the invite code you received.",
    };
  }

  if (cleaned.length < JOIN_CODE_MIN) {
    return {
      cleaned,
      isValid: false,
      message: `Code must be at least ${JOIN_CODE_MIN} characters.`,
    };
  }

  if (cleaned.length > JOIN_CODE_MAX) {
    return {
      cleaned,
      isValid: false,
      message: `Code must be ${JOIN_CODE_MAX} characters or fewer.`,
    };
  }

  if (!/^[A-Z0-9-]+$/.test(cleaned)) {
    return {
      cleaned,
      isValid: false,
      message: "Use capital letters, numbers, or a single hyphen.",
    };
  }

  const hyphenMatches = cleaned.match(/-/g);
  if (hyphenMatches && hyphenMatches.length > 1) {
    return {
      cleaned,
      isValid: false,
      message: "Only one hyphen is supported in invite codes.",
    };
  }

  if (cleaned.startsWith("-") || cleaned.endsWith("-")) {
    return {
      cleaned,
      isValid: false,
      message: "Place the hyphen between characters.",
    };
  }

  return { cleaned, isValid: true, message: "" };
}

const HINT_COPY =
  "Invite codes use 6-10 characters with uppercase letters or numbers. One hyphen is optional.";

interface JoinCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  error?: string;
  hint?: string;
  label?: string;
}

export default function JoinCodeInput({
  value,
  onChange,
  onBlur,
  disabled,
  error,
  hint = HINT_COPY,
  label = "Invite code",
}: JoinCodeInputProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const describedBy = [hint ? hintId : undefined, error ? errorId : undefined]
    .filter(Boolean)
    .join(" ");

  const controlBorderColor = error
    ? "var(--color-danger)"
    : isFocused
      ? "var(--color-accent)"
      : isHovered
        ? "var(--color-text)"
        : "var(--color-border)";

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(normalizeJoinCodeInput(event.target.value));
  }

  function handleBlur() {
    setIsFocused(false);
    onBlur?.();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <label
        htmlFor={inputId}
        style={{
          fontWeight: "var(--h3-weight)",
          color: "var(--color-text)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-1)",
        }}
      >
        {label}
        <span aria-hidden="true" style={{ color: "var(--color-accent)" }}>
          *
        </span>
      </label>

      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          border: `1px solid ${controlBorderColor}`,
          borderRadius: "var(--radius-md)",
          background: "var(--color-surface)",
          padding: "0 var(--space-4)",
          minHeight: "52px",
          display: "flex",
          alignItems: "center",
          transition: "border-color var(--dur-med) var(--ease), box-shadow var(--dur-med) var(--ease)",
          boxShadow: isFocused ? "0 0 0 2px var(--focus-ring)" : isHovered ? "var(--elev-1)" : "none",
        }}
      >
        <input
          id={inputId}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          disabled={disabled}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          aria-required="true"
          maxLength={JOIN_CODE_MAX}
          style={{
            border: "none",
            background: "transparent",
            width: "100%",
            font: "inherit",
            fontWeight: "var(--h3-weight)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-text)",
            padding: "var(--space-2) 0",
            outline: "none",
          }}
        />
      </div>

      {hint && (
        <p
          id={hintId}
          style={{
            margin: 0,
            fontSize: "var(--caption-size)",
            fontWeight: "var(--caption-weight)",
            color: "var(--color-text-muted)",
          }}
        >
          {hint}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          style={{
            margin: 0,
            fontSize: "var(--caption-size)",
            fontWeight: "var(--caption-weight)",
            color: "var(--color-danger)",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
