import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import FormField from "../ui/components/FormField";
import Input from "../ui/components/Input";
import Button from "../ui/components/Button";
import { useToast } from "../contexts/ToastContext";
import { apiFetch } from "../utils/api";
import type { SpaceOutletContext } from "./SpaceLayout";
import { useOutletContext } from "react-router-dom";
import "./SpaceWishlist.css";

interface WishlistGift {
  status?: string | null;
  sentimentPoints?: number | null;
  pricePointsLocked?: number | null;
}

interface WishlistItem {
  id: number;
  title: string;
  url?: string | null;
  image?: string | null;
  priceCents?: number | null;
  notes?: string | null;
  createdAt?: string;
  gift?: WishlistGift | null;
  points?: number | null;
}

type LoadState = "idle" | "loading" | "error" | "ready";
type FlowStep = "link" | "details";

interface ParsedGiftResponse {
  title: string | null;
  price: number | null;
  imageUrl: string | null;
}

interface GiftFormState {
  url: string;
  title: string;
  price: string;
  imageUrl: string;
  notes: string;
  points: string;
}

const INITIAL_FORM: GiftFormState = {
  url: "",
  title: "",
  price: "",
  imageUrl: "",
  notes: "",
  points: "",
};

function formatCurrency(priceCents?: number | null) {
  if (typeof priceCents !== "number" || Number.isNaN(priceCents)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(priceCents / 100);
}

function formatDate(iso?: string) {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString();
}

function normalizePriceInput(value: string): { value: number | null; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: null };
  }

  const cleaned = trimmed.replace(/[^0-9.,]/g, "").replace(/,/g, ".");
  if (!cleaned) {
    return { error: "Enter a valid price." };
  }

  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { error: "Enter a valid price." };
  }

  return { value: parsed };
}

function computePointsFromPriceInput(value: string): number | null {
  const { value: price } = normalizePriceInput(value);
  if (price === null) {
    return null;
  }
  return Math.max(0, Math.round(price));
}

function resolveItemPoints(item: WishlistItem): number {
  if (typeof item.points === "number") {
    return item.points;
  }
  if (typeof item.gift?.sentimentPoints === "number") {
    return item.gift.sentimentPoints;
  }
  if (typeof item.gift?.pricePointsLocked === "number") {
    return item.gift.pricePointsLocked;
  }
  if (typeof item.priceCents === "number") {
    return Math.max(0, Math.round(item.priceCents / 100));
  }
  return 0;
}

export default function SpaceWishlist() {
  const { space } = useOutletContext<SpaceOutletContext>();
  const { showToast } = useToast();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadError, setLoadError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [flowStep, setFlowStep] = useState<FlowStep>("link");
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [allowEditDetails, setAllowEditDetails] = useState(false);
  const [formState, setFormState] = useState<GiftFormState>(INITIAL_FORM);
  const [parseError, setParseError] = useState("");
  const [formError, setFormError] = useState("");
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isValueMode = useMemo(() => {
    const mode = (space.mode ?? "price").toLowerCase();
    return mode === "value" || mode === "sentiment";
  }, [space.mode]);

  const sortedItems = useMemo(() => {
    return items
      .slice()
      .sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return b.id - a.id;
      });
  }, [items]);

  const derivedPointsFromPrice = useMemo(() => {
    if (isValueMode) {
      return null;
    }
    return computePointsFromPriceInput(formState.price);
  }, [formState.price, isValueMode]);

  const loadWishlist = useCallback(async () => {
    setLoadState((previous) => (previous === "ready" ? previous : "loading"));
    setLoadError("");

    try {
      const response = await apiFetch(`/wishlist?spaceId=${space.id}`);
      const body = await response.json().catch(() => null);

      if (!response.ok || !Array.isArray(body)) {
        throw new Error(
          body && typeof body === "object" && typeof (body as { message?: string }).message === "string"
            ? (body as { message: string }).message
            : "Unable to load wishlist items.",
        );
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

  function resetFormState() {
    setFormState(INITIAL_FORM);
    setParseError("");
    setFormError("");
    setAllowEditDetails(false);
    setIsManualEntry(false);
    setFlowStep("link");
    setFetchingDetails(false);
  }

  function handleToggleForm() {
    setFormOpen((previous) => {
      const next = !previous;
      if (next) {
        resetFormState();
      } else {
        resetFormState();
      }
      return next;
    });
  }

  function handleManualEntry() {
    setFlowStep("details");
    setIsManualEntry(true);
    setAllowEditDetails(true);
    setParseError("");
  }

  async function handleFetchDetails() {
    const trimmedUrl = formState.url.trim();
    if (!trimmedUrl) {
      setParseError("Paste a valid Amazon link to continue.");
      return;
    }

    setFetchingDetails(true);
    setParseError("");

    try {
      const response = await apiFetch("/gifts/parse", {
        method: "POST",
        body: JSON.stringify({ url: trimmedUrl }),
      });
      const body = (await response.json().catch(() => null)) as ParsedGiftResponse | { message?: string } | null;

      if (!response.ok || !body || typeof body !== "object" || !("title" in body)) {
        const message =
          body && typeof (body as { message?: string }).message === "string"
            ? (body as { message: string }).message
            : "Unable to fetch details.";
        throw new Error(message);
      }

      const payload = body as ParsedGiftResponse;
      setFormState((previous) => ({
        ...previous,
        title: payload.title ?? previous.title,
        price: typeof payload.price === "number" ? payload.price.toFixed(2) : previous.price,
        imageUrl: payload.imageUrl ?? previous.imageUrl,
      }));
      setFlowStep("details");
      setIsManualEntry(false);
      setAllowEditDetails(false);
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : "Unable to fetch details. Enter them manually.";
      setParseError(message);
    } finally {
      setFetchingDetails(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (flowStep !== "details") {
      return;
    }

    setFormError("");

    const trimmedTitle = formState.title.trim();
    if (!trimmedTitle) {
      setFormError("Title is required.");
      return;
    }

    const trimmedUrl = formState.url.trim();
    const trimmedImage = formState.imageUrl.trim();
    const trimmedNotes = formState.notes.trim();

    const priceResult = normalizePriceInput(formState.price);
    if (priceResult.error) {
      setFormError(priceResult.error);
      return;
    }

    if (!isValueMode && priceResult.value === null) {
      setFormError("Price is required in this space.");
      return;
    }

    let pointsForPayload: number;
    if (isValueMode) {
      const trimmedPoints = formState.points.trim();
      const parsedPoints = Number.parseInt(trimmedPoints, 10);
      if (!trimmedPoints) {
        setFormError("Points are required.");
        return;
      }
      if (!Number.isFinite(parsedPoints) || parsedPoints <= 0) {
        setFormError("Enter a positive number of points.");
        return;
      }
      pointsForPayload = Math.trunc(parsedPoints);
    } else {
      const computed = priceResult.value !== null ? Math.max(0, Math.round(priceResult.value)) : null;
      if (computed === null) {
        setFormError("Price is required in this space.");
        return;
      }
      pointsForPayload = computed;
    }

    const payload: Record<string, unknown> = {
      title: trimmedTitle,
      points: pointsForPayload,
    };

    if (trimmedUrl) {
      payload.url = trimmedUrl;
    }

    if (priceResult.value !== null) {
      payload.price = Number(priceResult.value.toFixed(2));
    }

    if (trimmedImage) {
      payload.imageUrl = trimmedImage;
    }

    if (trimmedNotes) {
      payload.notes = trimmedNotes;
    }

    setSubmitting(true);

    try {
      const response = await apiFetch(`/spaces/${space.id}/gifts`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok || !body || typeof body !== "object") {
        const message =
          body && typeof (body as { message?: string }).message === "string"
            ? (body as { message: string }).message
            : "Unable to save item.";
        throw new Error(message);
      }

      const created = (body as { wishlistItem?: WishlistItem }).wishlistItem ?? (body as WishlistItem);
      setItems((previous) => [created, ...previous]);
      showToast({ intent: "success", description: "Wishlist item saved." });
      resetFormState();
      setFormOpen(false);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Unable to save item.";
      setFormError(message);
      showToast({ intent: "error", description: message });
    } finally {
      setSubmitting(false);
    }
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
            Paste an Amazon link, preview the details, then save it for both of you to see.
          </p>
        </div>
        <Button type="button" onClick={handleToggleForm}>
          {formOpen ? "Close form" : "Add item"}
        </Button>
      </header>

      {formOpen ? (
        <form className="space-wishlist__form" onSubmit={handleSubmit} noValidate>
          {flowStep === "link" ? (
            <div className="space-wishlist__step space-wishlist__step--link">
              <FormField htmlFor="wishlist-link" label="Amazon link" required>
                <Input
                  id="wishlist-link"
                  value={formState.url}
                  onChange={(event) => setFormState((previous) => ({ ...previous, url: event.target.value }))}
                  placeholder="https://www.amazon.com/..."
                  inputMode="url"
                  disabled={fetchingDetails}
                  autoComplete="off"
                />
              </FormField>

              {parseError ? (
                <p className="space-wishlist__status space-wishlist__status--error" role="alert">
                  {parseError}
                </p>
              ) : null}

              <div className="space-wishlist__step-actions">
                <Button type="button" onClick={() => void handleFetchDetails()} disabled={fetchingDetails}>
                  {fetchingDetails ? "Fetching…" : "Fetch details"}
                </Button>
                <button
                  type="button"
                  className="space-wishlist__text-action"
                  onClick={handleManualEntry}
                  disabled={fetchingDetails}
                >
                  Enter details manually
                </button>
              </div>
            </div>
          ) : (
            <div className="space-wishlist__step space-wishlist__step--details">
              <div className="space-wishlist__step-header">
                <p className="space-wishlist__step-title">Preview &amp; fine-tune</p>
                <div className="space-wishlist__step-controls">
                  <button
                    type="button"
                    className="space-wishlist__text-action"
                    onClick={() => {
                      setFlowStep("link");
                      setAllowEditDetails(false);
                      setIsManualEntry(false);
                      setFormError("");
                    }}
                    disabled={submitting}
                  >
                    Change link
                  </button>
                  {!isManualEntry ? (
                    <button
                      type="button"
                      className="space-wishlist__text-action"
                      onClick={() => setAllowEditDetails((previous) => !previous)}
                      disabled={submitting}
                    >
                      {allowEditDetails ? "Lock auto-fill" : "Edit fields"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="space-wishlist__details-grid">
                <div className="space-wishlist__details-main">
                  <FormField htmlFor="wishlist-title" label="Title" required>
                    <Input
                      id="wishlist-title"
                      value={formState.title}
                      onChange={(event) => setFormState((previous) => ({ ...previous, title: event.target.value }))}
                      placeholder="Example: Ceramic pour-over kettle"
                      readOnly={!allowEditDetails && !isManualEntry}
                      disabled={submitting}
                      className={!allowEditDetails && !isManualEntry ? "space-wishlist__input--readonly" : ""}
                    />
                  </FormField>

                  <div className="space-wishlist__detail-row">
                    <FormField
                      htmlFor="wishlist-price"
                      label="Price"
                      hint={isValueMode ? "Optional" : "Required"}
                      required={!isValueMode}
                    >
                      <Input
                        id="wishlist-price"
                        value={formState.price}
                        onChange={(event) => setFormState((previous) => ({ ...previous, price: event.target.value }))}
                        placeholder="49.99"
                        inputMode="decimal"
                        readOnly={!allowEditDetails && !isManualEntry}
                        disabled={submitting}
                        className={!allowEditDetails && !isManualEntry ? "space-wishlist__input--readonly" : ""}
                      />
                    </FormField>

                    <FormField htmlFor="wishlist-image" label="Image" hint="Optional">
                      <Input
                        id="wishlist-image"
                        value={formState.imageUrl}
                        onChange={(event) => setFormState((previous) => ({ ...previous, imageUrl: event.target.value }))}
                        placeholder="https://images..."
                        inputMode="url"
                        readOnly={!allowEditDetails && !isManualEntry}
                        disabled={submitting}
                        className={!allowEditDetails && !isManualEntry ? "space-wishlist__input--readonly" : ""}
                      />
                    </FormField>
                  </div>

                  {isValueMode ? (
                    <FormField htmlFor="wishlist-points" label="Points" required hint="Whole numbers only">
                      <Input
                        id="wishlist-points"
                        value={formState.points}
                        onChange={(event) => setFormState((previous) => ({ ...previous, points: event.target.value }))}
                        placeholder="40"
                        inputMode="numeric"
                        disabled={submitting}
                      />
                    </FormField>
                  ) : (
                    <p className="space-wishlist__points-hint" aria-live="polite">
                      Points based on price: {derivedPointsFromPrice ?? 0} pts
                    </p>
                  )}

                  <div className="space-wishlist__notes">
                    <label className="space-wishlist__notes-label" htmlFor="wishlist-notes">
                      Notes
                      <span className="space-wishlist__notes-hint">Optional</span>
                    </label>
                    <textarea
                      id="wishlist-notes"
                      className="space-wishlist__textarea"
                      value={formState.notes}
                      onChange={(event) => setFormState((previous) => ({ ...previous, notes: event.target.value }))}
                      placeholder="Sizing, delivery timing, or why it matters."
                      disabled={submitting}
                    />
                  </div>
                </div>

                <aside className="space-wishlist__preview">
                  {formState.imageUrl ? (
                    <div className="space-wishlist__preview-image">
                      <img src={formState.imageUrl} alt={formState.title || "Gift preview"} />
                    </div>
                  ) : (
                    <div className="space-wishlist__preview-placeholder" aria-hidden="true">
                      No image yet
                    </div>
                  )}
                  <dl className="space-wishlist__preview-meta">
                    <div>
                      <dt>Title</dt>
                      <dd>{formState.title || "—"}</dd>
                    </div>
                    <div>
                      <dt>Price</dt>
                      <dd>{formState.price ? `$${formState.price}` : "—"}</dd>
                    </div>
                    <div>
                      <dt>Points</dt>
                      <dd>
                        {isValueMode
                          ? formState.points || "—"
                          : `${derivedPointsFromPrice ?? 0} pts`}
                      </dd>
                    </div>
                  </dl>
                </aside>
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
            </div>
          )}
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
          <p className="space-wishlist__empty">No items yet. Paste your first link to begin.</p>
        ) : null}
        {loadState === "ready" && sortedItems.length > 0 ? (
          <div className="space-wishlist__grid">
            {sortedItems.map((item) => {
              const points = resolveItemPoints(item);
              return (
                <article key={item.id} className="space-wishlist__item">
                  {item.image ? (
                    <div className="space-wishlist__item-image">
                      <img src={item.image} alt={item.title} />
                    </div>
                  ) : null}
                  <div className="space-wishlist__item-body">
                    <header>
                      <div>
                        <h2>{item.title}</h2>
                        <p className="space-wishlist__price">{formatCurrency(item.priceCents)}</p>
                      </div>
                      <span className="space-wishlist__points">{points} pts</span>
                    </header>
                    {item.notes ? <p className="space-wishlist__notes-text">{item.notes}</p> : null}
                    <dl className="space-wishlist__meta">
                      <div>
                        <dt>Status</dt>
                        <dd>{item.gift?.status ?? "PENDING"}</dd>
                      </div>
                      <div>
                        <dt>Added</dt>
                        <dd>{formatDate(item.createdAt)}</dd>
                      </div>
                    </dl>
                    {item.url ? (
                      <a className="space-wishlist__link" href={item.url} target="_blank" rel="noreferrer">
                        View link
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
