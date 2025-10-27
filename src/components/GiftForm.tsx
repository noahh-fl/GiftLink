import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Gift } from "../types/gift";
import "./GiftForm.css";

type Status =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

interface GiftFormProps {
  spaceId: number;
  onGiftCreated: (gift: Gift) => void;
}

export function GiftForm({ spaceId, onGiftCreated }: GiftFormProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [touched, setTouched] = useState({ name: false, url: false });

  const trimmedName = name.trim();
  const trimmedUrl = url.trim();

  const errors = useMemo(() => {
    return {
      name: touched.name && !trimmedName ? "Gift name is required." : "",
      url: touched.url && !trimmedUrl ? "Gift URL is required." : "",
    };
  }, [touched, trimmedName, trimmedUrl]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ name: true, url: true });
    setStatus({ type: "idle" });

    if (!trimmedName || !trimmedUrl) {
      return;
    }

    setSubmitting(true);

    const payload: Record<string, unknown> = {
      name: trimmedName,
      url: trimmedUrl,
    };

    const trimmedCategory = category.trim();
    if (trimmedCategory) {
      payload.category = trimmedCategory;
    }

    const trimmedPrice = price.trim();
    if (trimmedPrice) {
      const parsedPrice = Number.parseFloat(trimmedPrice);
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        setStatus({ type: "error", message: "Price must be a non-negative number." });
        setSubmitting(false);
        return;
      }
      payload.price = parsedPrice;
    }

    try {
      const response = await fetch(`http://127.0.0.1:3000/space/${spaceId}/gift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await extractErrorMessage(response);
        throw new Error(message);
      }

      const createdGift: Gift = await response.json();
      onGiftCreated(createdGift);

      setName("");
      setUrl("");
      setPrice("");
      setCategory("");
      setTouched({ name: false, url: false });
      setStatus({ type: "success", message: "Gift added to the space." });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unable to add gift. Please try again.";
      setStatus({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="gift-form" aria-labelledby="gift-form-title">
      <header className="gift-form__header">
        <p className="gift-form__eyebrow">Add Gift</p>
        <h2 id="gift-form-title" className="gift-form__title">
          Drop a new wish into the space
        </h2>
        <p className="gift-form__hint">
          Name and link are required. Price helps with price-indexed spaces but can be left blank.
        </p>
      </header>

      <form
        className="gift-form__fields"
        onSubmit={handleSubmit}
        noValidate
        aria-describedby={status.type !== "idle" ? "gift-form-status" : undefined}
      >
        <div className="gift-form__field">
          <label className="gift-form__label" htmlFor="gift-name">
            Gift name <span aria-hidden="true">*</span>
          </label>
          <input
            id="gift-name"
            type="text"
            className={`gift-form__input${errors.name ? " gift-form__input--error" : ""}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "gift-name-error" : undefined}
            required
          />
          {errors.name && (
            <p id="gift-name-error" className="gift-form__error" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        <div className="gift-form__field">
          <label className="gift-form__label" htmlFor="gift-url">
            Gift URL <span aria-hidden="true">*</span>
          </label>
          <input
            id="gift-url"
            type="url"
            className={`gift-form__input${errors.url ? " gift-form__input--error" : ""}`}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, url: true }))}
            aria-invalid={errors.url ? true : undefined}
            aria-describedby={errors.url ? "gift-url-error" : undefined}
            inputMode="url"
            required
          />
          {errors.url && (
            <p id="gift-url-error" className="gift-form__error" role="alert">
              {errors.url}
            </p>
          )}
        </div>

        <div className="gift-form__field-row">
          <div className="gift-form__field gift-form__field--grow">
            <label className="gift-form__label" htmlFor="gift-price">
              Price
              <span className="gift-form__optional">optional</span>
            </label>
            <input
              id="gift-price"
              type="number"
              min="0"
              step="0.01"
              className="gift-form__input"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              inputMode="decimal"
            />
          </div>
          <div className="gift-form__field gift-form__field--grow">
            <label className="gift-form__label" htmlFor="gift-category">
              Category
              <span className="gift-form__optional">optional</span>
            </label>
            <input
              id="gift-category"
              type="text"
              className="gift-form__input"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />
          </div>
        </div>

        <div className="gift-form__actions">
          <button
            type="submit"
            className="gift-form__submit"
            disabled={submitting}
            aria-busy={submitting ? "true" : "false"}
          >
            {submitting ? "Adding…" : "Add Gift"}
          </button>
        </div>
      </form>

      {status.type !== "idle" && (
        <p
          id="gift-form-status"
          role="status"
          aria-live="polite"
          className={`gift-form__status gift-form__status--${status.type}`}
        >
          {status.message}
        </p>
      )}
    </section>
  );
}

async function extractErrorMessage(response: Response) {
  try {
    const body = await response.json();
    if (body && typeof body === "object" && "message" in body) {
      const value = body.message;
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
  } catch {
    // ignore parse errors
  }
  return `Request failed with status ${response.status}.`;
}
