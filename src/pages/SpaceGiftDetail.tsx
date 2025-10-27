import type { CSSProperties } from "react";
import { useParams } from "react-router-dom";

const containerStyle: CSSProperties = {
  background: "var(--color-bg)",
  minHeight: "100vh",
  padding: "var(--space-6)",
  color: "var(--color-text)",
};

const panelStyle: CSSProperties = {
  margin: "0 auto",
  maxWidth: "640px",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-6)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  color: "var(--color-text-muted)",
};

export default function SpaceGiftDetail() {
  const { spaceId, giftId } = useParams<{ spaceId: string; giftId: string }>();

  return (
    <main style={containerStyle}>
      <div style={panelStyle}>
        <h1 style={{ margin: 0, fontSize: "var(--h2-size)", fontWeight: "var(--h2-weight)" }}>
          Gift Detail
        </h1>
        <p style={subtitleStyle}>Gift Detail (coming soon)</p>
        <p style={subtitleStyle}>Space ID: {spaceId ?? "—"}</p>
        <p style={subtitleStyle}>Gift ID: {giftId ?? "—"}</p>
      </div>
    </main>
  );
}
