import { useState } from "react";

type PointMode = "price" | "sentiment";

export default function SpaceNew() {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [mode, setMode] = useState<PointMode | "">("");
  const [touched, setTouched] = useState({ name: false, mode: false });
  const [saved, setSaved] = useState(false);

  const nameErr = touched.name && !name.trim() ? "Space name is required." : "";
  const modeErr = touched.mode && !mode ? "Choose a point system." : "";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, mode: true });
    if (!name.trim() || !mode) return;
    const formData = { name: name.trim(), description: desc.trim(), mode };
    console.log("Space form:", formData);
    setSaved(true);
  }

  return (
    <main
      className="min-h-screen"
      style={{
        fontFamily: "var(--font-sans)",
        background: "var(--color-bg)",
        padding: "var(--space-8) var(--space-4)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <section style={{ width: "100%", maxWidth: 720 }}>
        <header style={{ marginBottom: "var(--space-6)" }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: "var(--space-2)" }}>
            Create New Space
          </h1>
          <p style={{ color: "var(--color-muted)" }}>
            Name your space, optionally describe it, then choose how points are calculated.
          </p>
        </header>

        <form onSubmit={onSubmit} noValidate>
          {/* Name */}
          <div style={{ marginBottom: "var(--space-4)" }}>
            <label htmlFor="space-name" style={{ display: "block", fontWeight: 600, marginBottom: "var(--space-2)" }}>
              Space name <span aria-hidden="true">*</span>
            </label>
            <input
              id="space-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              aria-describedby={nameErr ? "name-err" : undefined}
              aria-invalid={!!nameErr}
              required
              style={{
                width: "100%",
                height: 48,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                padding: "0 var(--space-3)",
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px var(--focus-ring) inset")}
              onBlurCapture={(e) => (e.currentTarget.style.boxShadow = "none")}
            />
            {nameErr && (
              <p id="name-err" role="alert" style={{ marginTop: "var(--space-1)", fontSize: 13 }}>
                {nameErr}
              </p>
            )}
          </div>

          {/* Description */}
          <div style={{ marginBottom: "var(--space-4)" }}>
            <label htmlFor="space-desc" style={{ display: "block", fontWeight: 600, marginBottom: "var(--space-2)" }}>
              Description <span style={{ fontWeight: 500, fontSize: 12 }}>(optional)</span>
            </label>
            <textarea
              id="space-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              style={{
                width: "100%",
                minHeight: 96,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                padding: "var(--space-2) var(--space-3)",
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px var(--focus-ring) inset")}
              onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
            />
          </div>

          {/* Point Mode */}
          <fieldset style={{ marginBottom: "var(--space-5)" }}>
            <legend style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>
              Point System Mode <span aria-hidden="true">*</span>
            </legend>
            <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: "var(--space-2)" }}>
              Price-Indexed: points ≈ price (rounded). Sentiment-Valued: points reflect importance.
            </p>

            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minHeight: 44 }}>
                <input
                  type="radio"
                  name="point-mode"
                  value="price"
                  checked={mode === "price"}
                  onChange={() => setMode("price")}
                  onBlur={() => setTouched((t) => ({ ...t, mode: true }))}
                />
                <span style={{ fontWeight: 600 }}>Price-Indexed</span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minHeight: 44 }}>
                <input
                  type="radio"
                  name="point-mode"
                  value="sentiment"
                  checked={mode === "sentiment"}
                  onChange={() => setMode("sentiment")}
                  onBlur={() => setTouched((t) => ({ ...t, mode: true }))}
                />
                <span style={{ fontWeight: 600 }}>Sentiment-Valued</span>
              </label>
            </div>

            {modeErr && (
              <p id="mode-err" role="alert" style={{ marginTop: "var(--space-1)", fontSize: 13 }}>
                {modeErr}
              </p>
            )}
          </fieldset>

          <button
            type="submit"
            style={{
              height: 44,
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
              padding: "0 var(--space-4)",
              fontWeight: 600,
              outline: "none",
              background: "var(--color-surface)",
            }}
            onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 2px var(--focus-ring) inset")}
            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
          >
            Create Space
          </button>

          {saved && (
            <p role="status" style={{ marginTop: "var(--space-3)" }}>
              Saved (stub).
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
