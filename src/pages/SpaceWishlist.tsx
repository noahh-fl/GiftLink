import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import FormField from "../ui/components/FormField";
import Input from "../ui/components/Input";
import Button from "../ui/components/Button";
import PageHeader from "../ui/components/PageHeader";
import PointsBadge from "../components/PointsBadge";
import { GiftCard } from "../components/GiftCard";
import { useToast } from "../contexts/ToastContext";
import { apiFetch } from "../utils/api";
import {
  computePointsFromPriceInput,
  formatCurrencyFromCents,
  normalizePriceInput,
} from "../utils/price";
import type { SpaceOutletContext } from "./SpaceLayout";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
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
  rawTitle: string | null;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
  asin?: string | null;
  features?: string[] | null;
  rating?: number | null;
  reviewCount?: number | null;
}

interface GiftFormState {
  url: string;
  title: string;
  price: string;
  imageUrl: string;
  notes: string;
  points: string;
  currency: string;
}

const INITIAL_FORM: GiftFormState = {
  url: "",
  title: "",
  price: "",
  imageUrl: "",
  notes: "",
  points: "",
  currency: "",
};

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

function sanitizeWishlistItem(raw: unknown): WishlistItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<WishlistItem> & { id?: unknown };
  const numericId =
    typeof candidate.id === "number"
      ? candidate.id
      : Number.parseInt(typeof candidate.id === "string" ? candidate.id : "", 10);

  if (!Number.isFinite(numericId)) {
    return null;
  }

  const safeTitle =
    typeof candidate.title === "string" && candidate.title.trim()
      ? candidate.title.trim()
      : `Gift #${numericId}`;

  return {
    id: numericId,
    title: safeTitle,
    url: typeof candidate.url === "string" ? candidate.url : null,
    image: typeof candidate.image === "string" ? candidate.image : null,
    priceCents: typeof candidate.priceCents === "number" ? candidate.priceCents : null,
    notes: typeof candidate.notes === "string" ? candidate.notes : null,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : undefined,
    gift: candidate.gift ?? null,
    points: typeof candidate.points === "number" ? candidate.points : null,
  };
}

function extractWishlistItems(payload: unknown): WishlistItem[] | null {
  let source: unknown;

  if (Array.isArray(payload)) {
    source = payload;
  } else if (payload && typeof payload === "object") {
    const container = payload as {
      gifts?: unknown;
      items?: unknown;
      wishlist?: unknown;
      wishlistItems?: unknown;
    };

    if (Array.isArray(container.gifts)) {
      source = container.gifts;
    } else if (Array.isArray(container.wishlistItems)) {
      source = container.wishlistItems;
    } else if (Array.isArray(container.items)) {
      source = container.items;
    } else if (Array.isArray(container.wishlist)) {
      source = container.wishlist;
    } else if (
      "gifts" in container ||
      "items" in container ||
      "wishlist" in container ||
      "wishlistItems" in container
    ) {
      return [];
    } else {
      return null;
    }
  } else {
    return null;
  }

  const list = Array.isArray(source) ? source : [];
  return list
    .map((item) => sanitizeWishlistItem(item))
    .filter((item): item is WishlistItem => item !== null);
}

export { extractWishlistItems };

export default function SpaceWishlist() {
  const { space } = useOutletContext<SpaceOutletContext>();
  const location = useLocation();
  const navigate = useNavigate();
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
  const [manualEntryNotice, setManualEntryNotice] = useState("");
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

  const previewPriceValue = useMemo(() => {
    const result = normalizePriceInput(formState.price);
    if (result.error || result.value === null) {
      return null;
    }
    return result.value;
  }, [formState.price]);

  const formattedPreviewPrice = useMemo(() => {
    if (previewPriceValue === null) {
      return "—";
    }

    const currencyCode = formState.currency || "USD";
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
      }).format(previewPriceValue);
    } catch {
      return `$${previewPriceValue.toFixed(2)}`;
    }
  }, [previewPriceValue, formState.currency]);

  const liveValueModePoints = useMemo(() => {
    const trimmed = formState.points.trim();
    if (!trimmed) {
      return 0;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }
    return Math.trunc(parsed);
  }, [formState.points]);

  const loadWishlist = useCallback(async () => {
    setLoadState((previous) => (previous === "ready" ? previous : "loading"));
    setLoadError("");

    try {
      const response = await apiFetch(`/wishlist?spaceId=${space.id}`);
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body && typeof body === "object" && typeof (body as { message?: string }).message === "string"
            ? (body as { message: string }).message
            : "Unable to load wishlist items.",
        );
      }

      const extracted = extractWishlistItems(body);
      if (extracted === null) {
        throw new Error("Unable to load wishlist items.");
      }

      setItems(extracted);
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

  useEffect(() => {
    const state = location.state as { openNewItem?: boolean } | null;
    if (state?.openNewItem) {
      setFormOpen(true);
      setFlowStep("link");
      setIsManualEntry(false);
      setAllowEditDetails(false);
      setFormState(() => ({ ...INITIAL_FORM }));
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  function resetFormState() {
    setFormState(() => ({ ...INITIAL_FORM }));
    setParseError("");
    setManualEntryNotice("");
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
    setManualEntryNotice("");
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
        price:
          typeof payload.price === "number"
            ? payload.price.toFixed(2)
            : previous.price,
        imageUrl: payload.imageUrl ?? previous.imageUrl,
        currency:
          typeof payload.currency === "string" && payload.currency.trim()
            ? payload.currency.trim().toUpperCase()
            : previous.currency,
      }));
      setFlowStep("details");
      setIsManualEntry(false);
      setAllowEditDetails(false);
      setManualEntryNotice("");
    } catch (error) {
      const fallbackManualMessage = "We couldn’t read that link. Try another or enter details manually.";
      const message =
        error instanceof Error && error.message && !/unable to fetch details/i.test(error.message)
          ? error.message
          : fallbackManualMessage;
      setManualEntryNotice(message);
      setFlowStep("details");
      setIsManualEntry(true);
      setAllowEditDetails(true);
      setParseError("");
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
      <PageHeader
        eyebrow="Wishlist"
        title={`Shared ideas for ${space.name}`}
        titleId="space-wishlist-title"
        description="Paste a link, let GiftLink fetch the details, then fine-tune it together."
        actions={
          <Button type="button" onClick={handleToggleForm}>
            {formOpen ? "Close form" : "Add item"}
          </Button>
        }
      />

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

              {manualEntryNotice ? (
                <p className="space-wishlist__status space-wishlist__status--info" role="status">
                  {manualEntryNotice}
                </p>
              ) : null}

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
                      hint={isValueMode ? "Optional" : "Points based on price"}
                      required={!isValueMode}
                    >
                      <Input
                        id="wishlist-price"
                        value={formState.price}
                        onChange={(event) => setFormState((previous) => ({ ...previous, price: event.target.value }))}
                        placeholder={isValueMode ? "" : "e.g. 49.99"}
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
                    <div className="space-wishlist__points-row">
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
                      <PointsBadge
                        className="space-wishlist__points-badge"
                        label={`${liveValueModePoints} pts`}
                        ariaLabel={`Current points value ${liveValueModePoints} points`}
                      />
                    </div>
                  ) : (
                    <div className="space-wishlist__points-summary" aria-live="polite">
                      {derivedPointsFromPrice !== null ? (
                        <PointsBadge
                          className="space-wishlist__points-badge"
                          label={`Worth ${derivedPointsFromPrice} pts`}
                          ariaLabel={`Worth ${derivedPointsFromPrice} points`}
                        />
                      ) : (
                        <p className="space-wishlist__points-placeholder">Enter a price to estimate points.</p>
                      )}
                      <p className="space-wishlist__points-caption">Points based on price.</p>
                    </div>
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
                      <dd>{formattedPreviewPrice}</dd>
                    </div>
                    <div>
                      <dt>Points</dt>
                      <dd>
                        <div className="space-wishlist__preview-points">
                          {isValueMode ? (
                            <PointsBadge
                              className="space-wishlist__points-badge"
                              label={`${liveValueModePoints} pts`}
                              ariaLabel={`Current points value ${liveValueModePoints} points`}
                            />
                          ) : derivedPointsFromPrice !== null ? (
                            <PointsBadge
                              className="space-wishlist__points-badge"
                              label={`Worth ${derivedPointsFromPrice} pts`}
                              ariaLabel={`Worth ${derivedPointsFromPrice} points`}
                            />
                          ) : (
                            <span className="space-wishlist__points-placeholder">Enter a valid price</span>
                          )}
                        </div>
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
              const priceText = formatCurrencyFromCents(item.priceCents);
              const priceLabel = priceText !== "—" ? priceText : null;
              const metaParts: string[] = [];
              if (item.gift?.status) {
                metaParts.push(item.gift.status.toLowerCase());
              }
              if (item.createdAt) {
                metaParts.push(`Added ${formatDate(item.createdAt)}`);
              }

              return (
                <GiftCard
                  key={item.id}
                  title={item.title}
                  image={item.image ?? null}
                  priceLabel={priceLabel}
                  pointsLabel={`${points} pts`}
                  notes={item.notes ?? undefined}
                  meta={metaParts.length > 0 ? metaParts.join(" • ") : null}
                  viewHref={item.url ?? null}
                />
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
