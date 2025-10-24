import { useState, type CSSProperties } from "react";

interface SpaceHeaderProps {
  name: string;
  inviteCode: string;
}

const containerStyle: CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-lg)",
  padding: "var(--space-6)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
  boxShadow: "var(--elev-1)",
};

const inviteRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-3)",
  alignItems: "center",
};

const copyButtonStyle: CSSProperties = {
  background: "var(--color-accent)",
  color: "var(--color-surface)",
  border: "none",
  borderRadius: "var(--radius-md)",
  padding: "0 var(--space-5)",
  minHeight: "var(--space-12)",
  fontSize: "var(--body-size)",
  fontWeight: "var(--h3-weight)",
  cursor: "pointer",
  transition: "background var(--dur-med) var(--ease), transform var(--dur-fast) var(--ease)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const statusStyle: CSSProperties = {
  fontSize: "var(--caption-size)",
  fontWeight: "var(--caption-weight)",
  color: "var(--color-text-muted)",
  minHeight: "var(--space-4)",
};

export default function SpaceHeader({ name, inviteCode }: SpaceHeaderProps) {
  const [copyStatus, setCopyStatus] = useState<string>("");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopyStatus("Invite code copied");
      window.setTimeout(() => setCopyStatus(""), 2000);
    } catch (error) {
      console.error("Clipboard copy failed", error);
      setCopyStatus("Unable to copy. Select and copy manually.");
    }
  };

  return (
    <header style={containerStyle} aria-labelledby="space-heading">
      <div>
        <p
          id="space-heading"
          style={{
            fontSize: "var(--h1-size)",
            fontWeight: "var(--h1-weight)",
            margin: 0,
          }}
        >
          {name}
        </p>
        <p
          style={{
            margin: 0,
            marginTop: "var(--space-2)",
            color: "var(--color-text-muted)",
          }}
        >
          Keep everyone on the same gifting page.
        </p>
      </div>

      <div style={inviteRowStyle}>
        <span
          style={{
            fontSize: "var(--h3-size)",
            fontWeight: "var(--h3-weight)",
          }}
          aria-label="Invite code"
        >
          {inviteCode}
        </span>
        <button
          type="button"
          className="focus-ring"
          onClick={handleCopy}
          style={copyButtonStyle}
          aria-label={`Copy invite code ${inviteCode}`}
        >
          Copy
        </button>
      </div>

      <div aria-live="polite" style={statusStyle}>
        {copyStatus}
      </div>
    </header>
  );
}
