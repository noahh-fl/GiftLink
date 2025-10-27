import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import Button from "../ui/components/Button";
import FormField from "../ui/components/FormField";
import Input from "../ui/components/Input";
import { useToast } from "../contexts/ToastContext";
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
  const { showToast } = useToast();

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
      showToast({ intent: "success", description: "Gift added to the wishlist." });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unable to add gift. Please try again.";
      setStatus({ type: "error", message });
      showToast({ intent: "error", description: message });
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
        <FormField
          label="Gift name"
          htmlFor="gift-name"
          required
          error={errors.name}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
            placeholder="LEGO Treehouse"
            hasError={Boolean(errors.name)}
          />
        </FormField>

        <FormField
          label="Gift URL"
          htmlFor="gift-url"
          required
          error={errors.url}
        >
          <Input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, url: true }))}
            placeholder="https://example.com/gift"
            hasError={Boolean(errors.url)}
            inputMode="url"
          />
        </FormField>

        <div className="gift-form__field-row">
          <FormField label="Price" htmlFor="gift-price" hint="Optional">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              hasError={false}
              inputMode="decimal"
            />
          </FormField>
          <FormField label="Category" htmlFor="gift-category" hint="Optional">
            <Input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              hasError={false}
            />
          </FormField>
        </div>

        <div className="gift-form__actions">
          <Button
            type="submit"
            disabled={submitting}
            aria-busy={submitting ? "true" : undefined}
          >
            {submitting ? "Adding…" : "Add Gift"}
          </Button>
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
