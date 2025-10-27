import { useId } from "react";
import type { ChangeEvent } from "react";
import FormField from "../ui/components/FormField";
import Input from "../ui/components/Input";
import "../ui/styles/components/join-code-input.css";

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

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(normalizeJoinCodeInput(event.target.value));
  }

  function handleBlur() {
    onBlur?.();
  }

  return (
    <FormField label={label} htmlFor={inputId} required hint={hint} error={error}>
      <Input
        id={inputId}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        hasError={Boolean(error)}
        aria-required="true"
        maxLength={JOIN_CODE_MAX}
        className="join-code-input__control"
      />
    </FormField>
  );
}
