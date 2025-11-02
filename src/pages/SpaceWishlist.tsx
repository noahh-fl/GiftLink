import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import FormField from "../ui/components/FormField";
import Input from "../ui/components/Input";
import Button from "../ui/components/Button";
import { useToast } from "../contexts/ToastContext";
import { apiFetch } from "../utils/api";
import {
  computePointsFromPriceInput,
  formatCurrencyFromCents,
  normalizePriceInput,
} from "../utils/price";
import { getUserIdentity } from "../utils/user";
import type { SpaceOutletContext } from "./SpaceLayout";
import Toolbar from "../ui/refresh/Toolbar";
import ViewToggle, { type ViewOption } from "../ui/refresh/ViewToggle";
import WishlistCard from "../ui/refresh/WishlistCard";
import {
  extractWishlistItems,
  resolveItemPoints,
  type WishlistItem,
} from "./SpaceWishlist.utils";
import styles from "./SpaceWishlist.module.css";

type LoadState = "idle" | "loading" | "error" | "ready";
type FlowStep = "link" | "details";
type ActiveTab = "mine" | "partners";

type ParsedGiftResponse = {
  title: string | null;
  rawTitle: string | null;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
  asin?: string | null;
  features?: string[] | null;
  rating?: number | null;
  reviewCount?: number | null;
};

type GiftFormState = {
  url: string;
  title: string;
  price: string;
  imageUrl: string;
  notes: string;
  points: string;
  currency: string;
};

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

export default function SpaceWishlist() {
  const { space } = useOutletContext<SpaceOutletContext>();
  const location = useLocation();
  const navigate = useNavigate();
  const identity = getUserIdentity();
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
  const [activeTab, setActiveTab] = useState<ActiveTab>("mine");
  const [viewMode, setViewMode] = useState<ViewOption>("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);

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

  const partnerItems = useMemo(() => {
    return sortedItems.filter((item) => {
      const giverId = item.gift?.giverId;
      return typeof giverId === "string" && giverId !== identity.id;
    });
  }, [identity.id, sortedItems]);

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

  const resetFormState = useCallback(() => {
    setFormState(() => ({ ...INITIAL_FORM }));
    setParseError("");
    setManualEntryNotice("");
    setFormError("");
    setAllowEditDetails(false);
    setIsManualEntry(false);
    setFlowStep("link");
    setFetchingDetails(false);
    setEditingItem(null);
  }, []);

  const openCreateForm = useCallback(() => {
    resetFormState();
    setFlowStep("link");
  }, [resetFormState]);

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
      openCreateForm();
      setFormOpen(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate, openCreateForm]);

  function handleToggleForm() {
    setFormOpen((previous) => {
      const next = !previous;
      if (next) {
        openCreateForm();
      } else {
        resetFormState();
      }
      return next;
    });
  }

  function handleEdit(item: WishlistItem) {
    setFormOpen(true);
    setFlowStep("details");
    setIsManualEntry(true);
    setAllowEditDetails(true);
    setEditingItem(item);
    setFormState({
      url: item.url ?? "",
      title: item.title,
      price: item.priceCents ? (item.priceCents / 100).toFixed(2) : "",
      imageUrl: item.image ?? "",
      notes: item.notes ?? "",
      points: String(resolveItemPoints(item) || ""),
      currency: "",
    });
    setManualEntryNotice("Editing item");
    setFormError("");
    setParseError("");
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
        price: typeof payload.price === "number" ? payload.price.toFixed(2) : previous.price,
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
      if (editingItem) {
        const response = await apiFetch(`/wishlist/${editingItem.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || !body || typeof body !== "object") {
          const message =
            body && typeof (body as { message?: string }).message === "string"
              ? (body as { message: string }).message
              : "Unable to update item.";
          throw new Error(message);
        }
        const updated = (body as { wishlistItem?: WishlistItem }).wishlistItem ?? (body as WishlistItem);
        setItems((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
        showToast({ intent: "success", description: "Wishlist item updated." });
      } else {
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
      }

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

  const displayItems = activeTab === "mine" ? sortedItems : partnerItems;
  const hasItems = displayItems.length > 0;
  const showPagination = hasItems;

  return (
    <div className={`ui-refresh-wishlist ${styles.page}`} aria-labelledby="space-wishlist-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Wishlist</p>
        <div className={styles.titleRow}>
          <h1 id="space-wishlist-title" className={styles.title}>
            Shared ideas for {space.name}
          </h1>
          {activeTab === "mine" ? (
            <Button type="button" onClick={handleToggleForm}>
              {formOpen ? "Close" : "New"}
            </Button>
          ) : null}
        </div>
        <nav className={styles.tabs} aria-label="Wishlist lists">
          <button
            type="button"
            className={[styles.tabButton, activeTab === "mine" ? styles.tabActive : undefined]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setActiveTab("mine")}
            aria-pressed={activeTab === "mine"}
          >
            My list
          </button>
          <button
            type="button"
            className={[styles.tabButton, activeTab === "partners" ? styles.tabActive : undefined]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setActiveTab("partners")}
            aria-pressed={activeTab === "partners"}
          >
            Partners list
          </button>
        </nav>
      </header>

      <Toolbar className={styles.toolbar}>
        {activeTab === "mine" ? null : <div className={styles.toolbarSpacer} />}
        <button type="button" className={styles.filterButton} onClick={() => setFiltersOpen((previous) => !previous)}>
          Filter
        </button>
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </Toolbar>

      {filtersOpen ? (
        <div className={styles.filterPanel} role="status">
          <p>No filters yet. Stay tuned!</p>
        </div>
      ) : null}

      {formOpen ? (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {flowStep === "link" ? (
            <div className={styles.linkStep}>
              <div className={styles.stepHeader}>
                <h2 className={styles.stepTitle}>Paste a link</h2>
                <p className={styles.stepHint}>We’ll pull details so you can fine-tune before sharing.</p>
              </div>
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
                <p className={styles.formStatus} role="alert">
                  {parseError}
                </p>
              ) : null}

              <div className={styles.stepActions}>
                <Button type="button" onClick={() => void handleFetchDetails()} disabled={fetchingDetails}>
                  {fetchingDetails ? "Fetching…" : "Fetch details"}
                </Button>
                <button type="button" className={styles.textAction} onClick={handleManualEntry} disabled={fetchingDetails}>
                  Enter details manually
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.detailsStep}>
              <div className={styles.stepHeader}>
                <h2 className={styles.stepTitle}>Preview &amp; fine-tune</h2>
                <div className={styles.stepControls}>
                  <button
                    type="button"
                    className={styles.textAction}
                    onClick={() => {
                      setFlowStep("link");
                      setAllowEditDetails(false);
                      setIsManualEntry(false);
                      setFormError("");
                      setEditingItem(null);
                    }}
                    disabled={submitting}
                  >
                    Change link
                  </button>
                  {!isManualEntry ? (
                    <button
                      type="button"
                      className={styles.textAction}
                      onClick={() => setAllowEditDetails((previous) => !previous)}
                      disabled={submitting}
                    >
                      {allowEditDetails ? "Lock auto-fill" : "Edit fields"}
                    </button>
                  ) : null}
                </div>
              </div>

              {manualEntryNotice ? (
                <p className={styles.notice}>{manualEntryNotice}</p>
              ) : null}

              <div className={styles.detailsGrid}>
                <div className={styles.formFields}>
                  <FormField htmlFor="wishlist-title" label="Title" required>
                    <Input
                      id="wishlist-title"
                      value={formState.title}
                      onChange={(event) => setFormState((previous) => ({ ...previous, title: event.target.value }))}
                      placeholder="Example: Ceramic pour-over kettle"
                      readOnly={!allowEditDetails && !isManualEntry}
                      disabled={submitting}
                    />
                  </FormField>

                  <div className={styles.row}>
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
                      />
                    </FormField>
                  </div>

                  {isValueMode ? (
                    <div className={styles.row}>
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
                      <div className={styles.pointsPreview} aria-live="polite">
                        <span className={styles.pointsPill}>{liveValueModePoints} pts</span>
                        <p className={styles.pointsCaption}>Current point value</p>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.pointsSummary} aria-live="polite">
                      {derivedPointsFromPrice !== null ? (
                        <span className={styles.pointsPill}>Worth {derivedPointsFromPrice} pts</span>
                      ) : (
                        <p className={styles.pointsPlaceholder}>Enter a price to estimate points.</p>
                      )}
                      <p className={styles.pointsCaption}>Points based on price.</p>
                    </div>
                  )}

                  <div className={styles.notesField}>
                    <label className={styles.notesLabel} htmlFor="wishlist-notes">
                      Notes <span className={styles.optional}>Optional</span>
                    </label>
                    <textarea
                      id="wishlist-notes"
                      className={styles.textarea}
                      value={formState.notes}
                      onChange={(event) => setFormState((previous) => ({ ...previous, notes: event.target.value }))}
                      placeholder="Sizing, delivery timing, or why it matters."
                      disabled={submitting}
                    />
                  </div>
                </div>

                <aside className={styles.previewPane}>
                  {formState.imageUrl ? (
                    <div className={styles.previewImage}>
                      <img src={formState.imageUrl} alt={formState.title || "Gift preview"} />
                    </div>
                  ) : (
                    <div className={styles.previewPlaceholder}>No image yet</div>
                  )}
                  <dl className={styles.previewMeta}>
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
                        <span className={styles.pointsPill}>
                          {isValueMode ? `${liveValueModePoints} pts` : derivedPointsFromPrice ?? "—"}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </aside>
              </div>

              {formError ? (
                <p className={styles.formStatus} role="alert">
                  {formError}
                </p>
              ) : null}

              <div className={styles.formActions}>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving…" : editingItem ? "Update item" : "Save item"}
                </Button>
              </div>
            </div>
          )}
        </form>
      ) : null}

      <section className={styles.listSection} aria-live="polite">
        {loadState === "loading" ? <p className={styles.status}>Loading wishlist…</p> : null}
        {loadState === "error" ? (
          <div className={styles.errorState}>
            <p>{loadError}</p>
            <Button type="button" variant="secondary" onClick={() => void loadWishlist()}>
              Retry
            </Button>
          </div>
        ) : null}
        {loadState === "ready" && !hasItems ? (
          <p className={styles.emptyState}>
            {activeTab === "mine" ? "No items yet. Add your first idea." : "No partner items yet."}
          </p>
        ) : null}

        {loadState === "ready" && hasItems ? (
          <div className={viewMode === "grid" ? styles.cardGrid : styles.listView}>
            {displayItems.map((item) => {
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

              if (viewMode === "grid") {
                return (
                  <WishlistCard
                    key={item.id}
                    title={item.title}
                    imageUrl={item.image ?? null}
                    priceLabel={priceLabel}
                    pointsLabel={`${points} pts`}
                    notes={item.notes ?? undefined}
                    meta={metaParts.length > 0 ? metaParts.join(" • ") : null}
                    actionLabel={activeTab === "mine" ? "Edit" : "View"}
                    onAction={activeTab === "mine" ? () => handleEdit(item) : undefined}
                    href={activeTab === "partners" ? item.url ?? undefined : undefined}
                    actionType={activeTab === "partners" ? "link" : "button"}
                  />
                );
              }

              return (
                <article key={item.id} className={styles.listRow}>
                  <div className={styles.listMeta}>
                    <h3 className={styles.listTitle}>{item.title}</h3>
                    {metaParts.length > 0 ? <p className={styles.listInfo}>{metaParts.join(" • ")}</p> : null}
                  </div>
                  <div className={styles.listPoints}>{points} pts</div>
                  <div className={styles.listPrice}>{priceLabel ?? "—"}</div>
                  <div className={styles.listAction}>
                    {activeTab === "mine" ? (
                      <button type="button" className={styles.inlineAction} onClick={() => handleEdit(item)}>
                        Edit
                      </button>
                    ) : item.url ? (
                      <a className={styles.inlineLink} href={item.url} target="_blank" rel="noreferrer">
                        View
                      </a>
                    ) : (
                      <span className={styles.inlineAction} aria-disabled="true">
                        View
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      {showPagination ? (
        <nav className={styles.pagination} aria-label="Wishlist pagination">
          <button type="button" className={[styles.pageButton, styles.pageButtonActive].join(" ")} disabled>
            1
          </button>
        </nav>
      ) : null}
    </div>
  );
}
