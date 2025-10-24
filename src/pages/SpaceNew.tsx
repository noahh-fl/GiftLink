import { FormEvent, useState } from "react";
import "./SpaceNew.css";

type PointMode = "price" | "sentiment";

type Status =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

interface CreatedSpace {
  id: number;
  name: string;
  description: string | null;
  mode: PointMode;
  createdAt: string;
}

const SPACE_ENDPOINT = "http://127.0.0.1:3000/space";

export default function SpaceNew() {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [mode, setMode] = useState<PointMode | "">("");
  const [touched, setTouched] = useState({ name: false, mode: false });
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [loading, setLoading] = useState(false);

  const trimmedName = name.trim();
  const trimmedDesc = desc.trim();

  const nameErr = touched.name && !trimmedName ? "Space name is required." : "";
  const modeErr = touched.mode && !mode ? "Choose a point system." : "";

  const resetStatus = () => {
    if (status.type !== "idle") {
      setStatus({ type: "idle" });
    }
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched({ name: true, mode: true });

    if (!trimmedName || !mode) return;

    setLoading(true);
    setStatus({ type: "idle" });

    const payload: Record<string, string> = {
      name: trimmedName,
      mode,
    };

    if (trimmedDesc) {
      payload.description = trimmedDesc;
    }

    try {
      const response = await fetch(SPACE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let responseBody: unknown = null;
      try {
        responseBody = await response.json();
      } catch {
        responseBody = null;
      }

      if (!response.ok || responseBody === null) {
        const message =
          responseBody &&
          typeof responseBody === "object" &&
          "message" in responseBody &&
          typeof (responseBody as { message?: unknown }).message === "string"
            ? ((responseBody as { message: string }).message || "Unable to create space.")
            : "Unable to create space.";
        throw new Error(message);
      }

      const createdSpace = responseBody as CreatedSpace;
      console.log("Created space:", createdSpace);
      setName("");
      setDesc("");
      setMode("");
      setTouched({ name: false, mode: false });
      setStatus({ type: "success", message: "Space created successfully." });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unable to create space.";
      setStatus({ type: "error", message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-new">
      <section className="space-new__panel">
        <header className="space-new__header">
          <p className="space-new__eyebrow">GiftLink Spaces</p>
          <h1 className="space-new__title">Create a new space</h1>
          <p className="space-new__subtitle">
            Name your space, optionally describe it, then choose how points are calculated.
          </p>
        </header>

        <form
          className="space-new__form"
          onSubmit={onSubmit}
          noValidate
          aria-describedby={status.type !== "idle" ? "space-new-status" : undefined}
        >
          <div className="space-new__field">
            <label className="space-new__label" htmlFor="space-name">
              Space name <span aria-hidden="true">*</span>
            </label>
            <input
              id="space-name"
              type="text"
              value={name}
              onChange={(event) => {
                resetStatus();
                setName(event.target.value);
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
              aria-describedby={nameErr ? "space-name-error" : undefined}
              aria-invalid={nameErr ? true : undefined}
              className={`space-new__input${nameErr ? " space-new__input--error" : ""}`}
              required
            />
            {nameErr && (
              <p id="space-name-error" className="space-new__error" role="alert">
                {nameErr}
              </p>
            )}
          </div>

          <div className="space-new__field">
            <label className="space-new__label" htmlFor="space-desc">
              Description <span className="space-new__label-optional">optional</span>
            </label>
            <textarea
              id="space-desc"
              value={desc}
              onChange={(event) => {
                resetStatus();
                setDesc(event.target.value);
              }}
              className="space-new__textarea"
            />
          </div>

          <fieldset
            className={`space-new__fieldset${modeErr ? " space-new__fieldset--error" : ""}`}
            aria-describedby={modeErr ? "space-mode-error" : undefined}
          >
            <legend className="space-new__legend">
              Point system mode <span aria-hidden="true">*</span>
            </legend>
            <p className="space-new__fieldset-hint">
              Price-Indexed keeps points aligned with cost. Sentiment-Valued lets you boost meaningful moments.
            </p>

            <div className="space-new__choices">
              <label
                className={`space-new__choice${mode === "price" ? " space-new__choice--active" : ""}`}
              >
                <input
                  className="space-new__radio"
                  type="radio"
                  name="point-mode"
                  value="price"
                  checked={mode === "price"}
                  onChange={() => {
                    resetStatus();
                    setMode("price");
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, mode: true }))}
                  aria-invalid={modeErr ? true : undefined}
                />
                <span className="space-new__choice-content">
                  <span className="space-new__choice-title">Price-indexed</span>
                  <span className="space-new__choice-hint">
                    Points mirror the item price, rounded to the nearest whole number.
                  </span>
                </span>
              </label>

              <label
                className={`space-new__choice${mode === "sentiment" ? " space-new__choice--active" : ""}`}
              >
                <input
                  className="space-new__radio"
                  type="radio"
                  name="point-mode"
                  value="sentiment"
                  checked={mode === "sentiment"}
                  onChange={() => {
                    resetStatus();
                    setMode("sentiment");
                  }}
                  onBlur={() => setTouched((prev) => ({ ...prev, mode: true }))}
                  aria-invalid={modeErr ? true : undefined}
                />
                <span className="space-new__choice-content">
                  <span className="space-new__choice-title">Sentiment-valued</span>
                  <span className="space-new__choice-hint">
                    Award bigger points to gestures that feel special, regardless of price.
                  </span>
                </span>
              </label>
            </div>

            {modeErr && (
              <p id="space-mode-error" className="space-new__error" role="alert">
                {modeErr}
              </p>
            )}
          </fieldset>

          <button
            type="submit"
            className="space-new__submit"
            disabled={loading}
            aria-busy={loading ? "true" : "false"}
          >
            {loading ? "Creating…" : "Create Space"}
          </button>

          {status.type !== "idle" && (
            <p
              id="space-new-status"
              role="status"
              aria-live="polite"
              className={`space-new__status space-new__status--${status.type}`}
            >
              {status.message}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
