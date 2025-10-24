import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import JoinCodeInput, { validateJoinCode } from "../components/JoinCodeInput";

type Status =
  | { type: "idle" }
  | { type: "info"; message: string }
  | { type: "error"; message: string };

const SCREENSHOT_URL = "https://github.com/noahflewelling/giftlink/wiki/SpaceJoin-Preview";
const SAMPLE_CODES = ["GL-8273", "739402"];

const pageStyle = {
  minHeight: "100vh",
  background: "var(--color-bg)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "var(--space-12) var(--space-4)",
};

const panelStyle = {
  width: "100%",
  maxWidth: "640px",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  padding: "var(--space-8)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-6)",
  transition: "box-shadow var(--dur-med) var(--ease), transform var(--dur-med) var(--ease)",
};

const headerStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
};

const formStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
};

const exampleSectionStyle = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-4)",
  background: "var(--color-bg)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
};

export default function SpaceJoin() {
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [panelHovered, setPanelHovered] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);
  const [buttonFocused, setButtonFocused] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [exampleLinkFocused, setExampleLinkFocused] = useState(false);
  const pendingRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pendingRef.current) {
        window.clearTimeout(pendingRef.current);
      }
    };
  }, []);

  const validation = validateJoinCode(inviteCode);
  const isValid = validation.isValid;
  const inlineError = touched && !validation.isValid ? validation.message : "";

  const statusId = status.type !== "idle" ? "space-join-status" : undefined;

  function handleCodeChange(nextValue: string) {
    if (status.type !== "idle") {
      setStatus({ type: "idle" });
    }
    setInviteCode(nextValue);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);

    if (!validation.isValid) {
      return;
    }

    setLoading(true);
    setStatus({ type: "info", message: "Checking invite code..." });

    if (pendingRef.current) {
      window.clearTimeout(pendingRef.current);
    }

    const cleaned = validation.cleaned;

    pendingRef.current = window.setTimeout(() => {
      pendingRef.current = null;

      if (/^[0-9]+$/.test(cleaned)) {
        navigate(`/space/${cleaned}/gifts`);
        return;
      }

      setLoading(false);
      setStatus({
        type: "error",
        message: "Invalid or unsupported code",
      });
    }, 350);
  }

  const buttonDisabled = !isValid || loading;

  return (
    <main style={pageStyle}>
      <section
        aria-labelledby="space-join-heading"
        style={{
          ...panelStyle,
          boxShadow: panelHovered ? "var(--elev-2)" : "var(--elev-1)",
          transform: panelHovered ? "translateY(-2px)" : "translateY(0)",
        }}
        onMouseEnter={() => setPanelHovered(true)}
        onMouseLeave={() => setPanelHovered(false)}
      >
        <header style={headerStyle}>
          <p
            style={{
              fontSize: "var(--caption-size)",
              fontWeight: "var(--caption-weight)",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
            }}
          >
            GiftLink Spaces
          </p>
          <h1 id="space-join-heading">Join an existing space</h1>
          <p style={{ color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            Enter the invite code that was shared with you. We&apos;ll verify it instantly and
            route you straight into the shared wishlist.
          </p>
        </header>

        <form
          style={formStyle}
          onSubmit={handleSubmit}
          noValidate
          aria-describedby={statusId}
        >
          <JoinCodeInput
            value={inviteCode}
            onChange={handleCodeChange}
            onBlur={() => setTouched(true)}
            disabled={loading}
            error={inlineError}
          />

          <button
            type="submit"
            disabled={buttonDisabled}
            aria-busy={loading}
            onMouseEnter={() => setButtonHovered(true)}
            onMouseLeave={() => setButtonHovered(false)}
            onFocus={() => setButtonFocused(true)}
            onBlur={() => setButtonFocused(false)}
            style={{
              border: "none",
              borderRadius: "var(--radius-md)",
              padding: "0 var(--space-5)",
              minHeight: "52px",
              fontWeight: "var(--h3-weight)",
              fontSize: "var(--body-size)",
              background: buttonDisabled ? "var(--color-border)" : "var(--color-accent)",
              color: buttonDisabled ? "var(--color-text-muted)" : "var(--color-surface)",
              cursor: buttonDisabled ? "not-allowed" : "pointer",
              transition:
                "transform var(--dur-fast) var(--ease), box-shadow var(--dur-med) var(--ease), background var(--dur-med) var(--ease)",
              boxShadow:
                buttonDisabled || (!buttonHovered && !buttonFocused)
                  ? "var(--elev-1)"
                  : "var(--elev-2)",
              transform: buttonHovered && !buttonDisabled ? "translateY(-1px)" : "translateY(0)",
              outline: buttonFocused ? "2px solid var(--focus-ring)" : "none",
              outlineOffset: "2px",
            }}
          >
            {loading ? "Checking..." : "Continue to space"}
          </button>

          {status.type !== "idle" && (
            <p
              id={statusId}
              role={status.type === "error" ? "alert" : "status"}
              aria-live="polite"
              style={{
                margin: 0,
                fontSize: "var(--caption-size)",
                fontWeight: "var(--caption-weight)",
                color:
                  status.type === "error" ? "var(--color-danger)" : "var(--color-text-muted)",
              }}
            >
              {status.message}
            </p>
          )}
        </form>

        <section
          aria-labelledby="space-join-example-heading"
          style={exampleSectionStyle}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <p
              id="space-join-example-heading"
              style={{
                fontWeight: "var(--h3-weight)",
                color: "var(--color-text)",
                margin: 0,
              }}
            >
              In-page example
            </p>
            <p style={{ margin: 0, color: "var(--color-text-muted)", lineHeight: 1.4 }}>
              Try one of these sample codes to preview the validation states.
            </p>
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
              {SAMPLE_CODES.map((code) => (
                <span
                  key={code}
                  style={{
                    borderRadius: "var(--radius-sm)",
                    padding: "var(--space-2) var(--space-3)",
                    background: "var(--color-accent-quiet)",
                    color: "var(--color-text)",
                    fontWeight: "var(--h3-weight)",
                    letterSpacing: "0.08em",
                  }}
                >
                  {code}
                </span>
              ))}
            </div>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "var(--caption-size)" }}>
              Screenshot link below shows the full flow for release notes.
            </p>
          </div>

          <a
            href={SCREENSHOT_URL}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-1)",
              fontWeight: "var(--h3-weight)",
              color: "var(--color-accent)",
              borderRadius: "var(--radius-sm)",
              padding: "var(--space-2) var(--space-3)",
              minHeight: "44px",
              outline: exampleLinkFocused ? "2px solid var(--focus-ring)" : "none",
              outlineOffset: "2px",
            }}
            onFocus={() => setExampleLinkFocused(true)}
            onBlur={() => setExampleLinkFocused(false)}
          >
            View latest screenshot (opens in new tab)
          </a>
        </section>
      </section>
    </main>
  );
}
