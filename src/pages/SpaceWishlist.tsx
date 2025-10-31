import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import FormField from "../ui/components/FormField";
import Input from "../ui/components/Input";
import Button from "../ui/components/Button";
import { apiFetch } from "../utils/api";
import type { SpaceOutletContext } from "./SpaceLayout";
import { useOutletContext } from "react-router-dom";
import "./SpaceWishlist.css";

interface WishlistGift {
  status?: string | null;
}

interface WishlistItem {
  id: number;
  title: string;
  url?: string | null;
  priceCents?: number | null;
  notes?: string | null;
  createdAt?: string;
  gift?: WishlistGift | null;
}

type LoadState = "idle" | "loading" | "error" | "ready";

export default function SpaceWishlist() {
  const { space } = useOutletContext<SpaceOutletContext>();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");

  const sortedItems = useMemo(() => items.slice().sort((a, b) => a.id - b.id), [items]);

  const loadWishlist = useCallback(async () => {
    setLoadState((previous) => (previous === "ready" ? previous : "loading"));
    setLoadError("");

    try {
      const response = await apiFetch(`/wishlist?spaceId=${space.id}`);
      const body = await response.json().catch(() => null);

      if (!response.ok || !Array.isArray(body)) {
        throw new Error("Unable to load wishlist items.");
      }

      setItems(body as WishlistItem[]);
      setLoadState("ready");
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : "Unable to load wishlist items.";
      setLoadError(message);
      setLoadState("error");
    }
  }, [space.id]);

  useEffect(() => {
    void loadWishlist();
  }, [loadWishlist]);

  function resetForm() {
    setTitle("");
    setPrice("");
    setLink("");
    setNotes("");
    setFormError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const trimmedTitle = title.trim();
    const trimmedLink = link.trim();
    const trimmedNotes = notes.trim();
    const trimmedPrice = price.trim();

    if (!trimmedTitle) {
      setFormError("Title is required.");
      return;
    }

    let priceCents: number | null = null;
    if (trimmedPrice) {
      const parsed = Number.parseFloat(trimmedPrice.replace(/[^0-9.]/g, ""));
      if (!Number.isFinite(parsed) || parsed < 0) {
        setFormError("Enter a valid price.");
        return;
      }
      priceCents = Math.round(parsed * 100);
    }

    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        spaceId: space.id,
        title: trimmedTitle,
      };

      if (trimmedLink) {
        payload.url = trimmedLink;
      }
      if (trimmedNotes) {
        payload.notes = trimmedNotes;
      }
      if (priceCents !== null) {
        payload.priceCents = priceCents;
      }

      const response = await apiFetch("/wishlist", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok || !body || typeof body !== "object") {
        throw new Error("Unable to add item.");
      }

      const created = body as WishlistItem;
      setItems((previous) => [created, ...previous]);
      resetForm();
      setFormOpen(false);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Unable to add item.";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function formatPrice(cents?: number | null) {
    if (typeof cents !== "number" || Number.isNaN(cents)) {
      return "—";
    }
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  }

  return (
    <div className="space-wishlist" aria-labelledby="space-wishlist-title">
      <header className="space-wishlist__header">
        <div>
          <p className="space-wishlist__eyebrow">Wishlist</p>
          <h1 id="space-wishlist-title" className="space-wishlist__title">
            Shared ideas for {space.name}
          </h1>
          <p className="space-wishlist__subtitle">
            Everyone in this space can see and add items. Keep notes to hint at why it matters.
          </p>
        </div>
        <Button type="button" onClick={() => setFormOpen((prev) => !prev)}>
          {formOpen ? "Cancel" : "Add item"}
        </Button>
      </header>

      {formOpen ? (
        <form className="space-wishlist__form" onSubmit={handleSubmit} noValidate>
          <FormField htmlFor="wishlist-title" label="Title" required>
            <Input
              id="wishlist-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Pour-over kettle"
              disabled={submitting}
            />
          </FormField>

          <div className="space-wishlist__form-grid">
            <FormField htmlFor="wishlist-price" label="Price" hint="USD">
              <Input
                id="wishlist-price"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="45"
                disabled={submitting}
                inputMode="decimal"
              />
            </FormField>
            <FormField htmlFor="wishlist-link" label="Link">
              <Input
                id="wishlist-link"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                placeholder="https://"
                disabled={submitting}
                inputMode="url"
              />
            </FormField>
          </div>

          <div className="space-wishlist__notes">
            <label className="space-wishlist__notes-label" htmlFor="wishlist-notes">
              Notes
              <span className="space-wishlist__notes-hint">Optional</span>
            </label>
            <textarea
              id="wishlist-notes"
              className="space-wishlist__textarea"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Context, sizes, or delivery timing."
              disabled={submitting}
            />
          </div>

          {formError ? (
            <p className="space-wishlist__status space-wishlist__status--error" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="space-wishlist__form-actions">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save item"}
            </Button>
          </div>
        </form>
      ) : null}

      <section className="space-wishlist__list" aria-live="polite">
        {loadState === "loading" ? <p className="space-wishlist__loading">Loading wishlist…</p> : null}
        {loadState === "error" ? (
          <div className="space-wishlist__error">
            <p>{loadError}</p>
            <Button type="button" variant="secondary" onClick={() => void loadWishlist()}>
              Retry
            </Button>
          </div>
        ) : null}
        {loadState === "ready" && sortedItems.length === 0 ? (
          <p className="space-wishlist__empty">No items yet. Add the first wish to get started.</p>
        ) : null}
        {loadState === "ready" && sortedItems.length > 0 ? (
          <div className="space-wishlist__grid">
            {sortedItems.map((item) => (
              <article key={item.id} className="space-wishlist__item">
                <header>
                  <h2>{item.title}</h2>
                  <p className="space-wishlist__price">{formatPrice(item.priceCents)}</p>
                </header>
                {item.notes ? <p className="space-wishlist__notes-text">{item.notes}</p> : null}
                <dl className="space-wishlist__meta">
                  <div>
                    <dt>Gift status</dt>
                    <dd>{item.gift?.status ?? "PENDING"}</dd>
                  </div>
                  <div>
                    <dt>Added</dt>
                    <dd>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}</dd>
                  </div>
                </dl>
                {item.url ? (
                  <a className="space-wishlist__link" href={item.url} target="_blank" rel="noreferrer">
                    View link
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
