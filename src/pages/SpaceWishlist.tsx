import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
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
  const [pendingDelete, setPendingDelete] = useState<WishlistItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const deleteCancelRef = useRef<HTMLButtonElement | null>(null);
  const deleteButtonRefs = useRef(new Map<number, HTMLButtonElement>());
  const lastDeleteTriggerId = useRef<number | null>(null);
  const listSectionRef = useRef<HTMLElement | null>(null);
  const archiveCancelRef = useRef<HTMLButtonElement | null>(null);
  const archiveConfirmRef = useRef<HTMLButtonElement | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setConfirmArchiveOpen(false);
  }, []);

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
      if (item.archived) {
        return false;
      }
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
    setSelectedIds((previous) => {
      if (previous.size === 0) {
        return previous;
      }

      const validIds = new Set(items.map((item) => item.id));
      let changed = false;
      const next = new Set<number>();

      previous.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });

      return changed ? next : previous;
    });
  }, [items]);

  useEffect(() => {
    const state = location.state as { openNewItem?: boolean } | null;
    if (state?.openNewItem) {
      openCreateForm();
      setFormOpen(true);
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate, openCreateForm]);

  useEffect(() => {
    if (!pendingDelete) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleteLoading) {
        event.preventDefault();
        setPendingDelete(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const frame = window.requestAnimationFrame(() => {
      deleteCancelRef.current?.focus();
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(frame);
    };
  }, [pendingDelete, deleteLoading]);

  useEffect(() => {
    if (pendingDelete) {
      return;
    }

    if (lastDeleteTriggerId.current !== null) {
      const trigger = deleteButtonRefs.current.get(lastDeleteTriggerId.current);
      const fallback = listSectionRef.current;
      if (trigger) {
        window.requestAnimationFrame(() => {
          trigger.focus();
        });
      } else if (fallback) {
        window.requestAnimationFrame(() => {
          fallback.focus();
        });
      }
      lastDeleteTriggerId.current = null;
    }
  }, [pendingDelete]);

  useEffect(() => {
    if (activeTab !== "mine") {
      clearSelection();
    }
  }, [activeTab, clearSelection]);

  useEffect(() => {
    if (selectedIds.size === 0 && !confirmArchiveOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        clearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedIds, confirmArchiveOpen, clearSelection]);

  useEffect(() => {
    if (!confirmArchiveOpen) {
      return;
    }

    const focusable = [archiveCancelRef.current, archiveConfirmRef.current].filter(
      (node): node is HTMLButtonElement => Boolean(node),
    );

    const frame = window.requestAnimationFrame(() => {
      archiveCancelRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || focusable.length === 0) {
        return;
      }

      event.preventDefault();

      if (focusable.length === 1) {
        focusable[0]?.focus();
        return;
      }

      const activeElement = document.activeElement as HTMLElement | null;
      const currentIndex = activeElement ? focusable.indexOf(activeElement as HTMLButtonElement) : -1;
      if (event.shiftKey) {
        const previousIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
        focusable[previousIndex]?.focus();
      } else {
        const nextIndex = currentIndex === focusable.length - 1 ? 0 : currentIndex + 1;
        focusable[nextIndex]?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(frame);
    };
  }, [confirmArchiveOpen]);

  useEffect(() => {
    if (confirmArchiveOpen && selectedIds.size === 0) {
      setConfirmArchiveOpen(false);
    }
  }, [confirmArchiveOpen, selectedIds]);

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

  const setDeleteButtonNode = useCallback((id: number, node: HTMLButtonElement | null) => {
    if (node) {
      deleteButtonRefs.current.set(id, node);
    } else {
      deleteButtonRefs.current.delete(id);
    }
  }, []);

  const handleRequestDelete = useCallback((item: WishlistItem) => {
    lastDeleteTriggerId.current = item.id;
    setPendingDelete(item);
  }, []);

  const handleCancelDelete = useCallback(() => {
    if (deleteLoading) {
      return;
    }
    setPendingDelete(null);
  }, [deleteLoading]);

  const handleDeleteOverlayClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && !deleteLoading) {
        setPendingDelete(null);
      }
    },
    [deleteLoading],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) {
      return;
    }

    setDeleteLoading(true);

    try {
      const response = await apiFetch(`/wishlist/${pendingDelete.id}`, { method: "DELETE" });

      if (response.status === 204) {
        setItems((previous) => previous.filter((item) => item.id !== pendingDelete.id));
        showToast({ intent: "success", description: "Wishlist item deleted." });
        setPendingDelete(null);
      } else {
        const body = await response.json().catch(() => null);
        const message =
          body && typeof body === "object" && typeof (body as { message?: string }).message === "string"
            ? (body as { message: string }).message
            : "Unable to delete item.";
        throw new Error(message);
      }
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Unable to delete item.";
      showToast({ intent: "error", description: message });
    } finally {
      setDeleteLoading(false);
    }
  }, [pendingDelete, setItems, showToast]);

  const handleToggleSelection = useCallback((id: number) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleCancelArchive = useCallback(() => {
    if (archiveLoading) {
      return;
    }
    setConfirmArchiveOpen(false);
  }, [archiveLoading]);

  const handleArchiveOverlayClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && !archiveLoading) {
        setConfirmArchiveOpen(false);
      }
    },
    [archiveLoading],
  );

  const handleArchiveSelected = useCallback(async () => {
    if (selectedIds.size === 0 || archiveLoading) {
      return;
    }

    const ids = Array.from(selectedIds);
    const idsSet = new Set(ids);
    const timestamp = new Date().toISOString();
    const previousItems = items;

    setArchiveLoading(true);
    setItems((previous) =>
      previous
        .map((item) =>
          idsSet.has(item.id) ? { ...item, archived: true, archivedAt: timestamp } : item,
        )
        .filter((item) => !idsSet.has(item.id)),
    );

    try {
      const response = await apiFetch(`/wishlist/bulk-archive`, {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok || !body || typeof body !== "object") {
        const message =
          body && typeof (body as { message?: string }).message === "string"
            ? (body as { message: string }).message
            : "Unable to archive items.";
        throw new Error(message);
      }

      const payload = body as { updatedCount?: unknown; notFound?: unknown };
      const updatedCount =
        typeof payload.updatedCount === "number" && Number.isFinite(payload.updatedCount)
          ? payload.updatedCount
          : ids.length;
      const missingCount = Array.isArray(payload.notFound) ? payload.notFound.length : 0;
      const archivedLabel = updatedCount === 1 ? "item" : "items";
      const description =
        missingCount > 0
          ? `Archived ${updatedCount} ${archivedLabel}. ${missingCount} already handled.`
          : `Archived ${updatedCount} ${archivedLabel}.`;
      showToast({ intent: "success", description });
      clearSelection();
    } catch (error) {
      setItems(previousItems);
      const message = error instanceof Error && error.message ? error.message : "Unable to archive items.";
      showToast({ intent: "error", description: message });
      setConfirmArchiveOpen(false);
    } finally {
      setArchiveLoading(false);
    }
  }, [archiveLoading, clearSelection, items, selectedIds, showToast]);

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

      // For sentiment mode, suggest points based on price (but user can edit)
      let suggestedPoints = "";
      if (isValueMode && typeof payload.price === "number") {
        suggestedPoints = String(Math.max(1, Math.round(payload.price)));
      }

      setFormState((previous) => ({
        ...previous,
        title: payload.title ?? previous.title,
        price: typeof payload.price === "number" ? payload.price.toFixed(2) : previous.price,
        imageUrl: payload.imageUrl ?? previous.imageUrl,
        currency:
          typeof payload.currency === "string" && payload.currency.trim()
            ? payload.currency.trim().toUpperCase()
            : previous.currency,
        points: suggestedPoints || previous.points,
      }));
      setFlowStep("details");
      setIsManualEntry(false);
      setAllowEditDetails(true); // Allow editing points in sentiment mode
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

  const activeItems = useMemo(() => {
    return sortedItems.filter((item) => !item.archived);
  }, [sortedItems]);

  const displayItems = activeTab === "mine" ? activeItems : partnerItems;
  const hasItems = displayItems.length > 0;
  const showPagination = hasItems;
  const selectionEnabled = activeTab === "mine";
  const isSelectionMode = selectionEnabled && selectedIds.size > 0;
  const selectedCount = selectedIds.size;

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
                      <FormField htmlFor="wishlist-points" label="Points" required hint="How much you value this gift">
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

      <section
        ref={listSectionRef}
        className={styles.listSection}
        aria-live="polite"
        tabIndex={-1}
      >
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

              const isOwnerView = selectionEnabled;
              const isSelected = selectedIds.has(item.id);
              const deleteDisabled =
                isOwnerView && (archiveLoading || (pendingDelete?.id === item.id ? deleteLoading : false));
              const selectionControl = selectionEnabled ? (
                <label
                  className={[styles.selectionCheckboxLabel, isSelected ? styles.selectionCheckboxLabelSelected : undefined]
                    .filter(Boolean)
                    .join(" ")}
                  data-selected={isSelected ? "true" : undefined}
                >
                  <input
                    type="checkbox"
                    className={styles.selectionCheckbox}
                    checked={isSelected}
                    onChange={() => handleToggleSelection(item.id)}
                    disabled={archiveLoading}
                  />
                  <span className="sr-only">Select {item.title}</span>
                </label>
              ) : null;

              if (viewMode === "grid") {
                return (
                  <div
                    key={item.id}
                    className={[
                      styles.selectionItem,
                      styles.gridSelectionItem,
                      isSelected ? styles.selectionItemSelected : undefined,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {selectionControl}
                    <WishlistCard
                      title={item.title}
                      imageUrl={item.image ?? null}
                      priceLabel={priceLabel}
                      pointsLabel={`${points} pts`}
                      notes={item.notes ?? undefined}
                      meta={metaParts.length > 0 ? metaParts.join(" • ") : null}
                      actionLabel={isOwnerView ? "Edit" : "View"}
                      onAction={isOwnerView ? () => handleEdit(item) : undefined}
                      href={!isOwnerView ? item.url ?? undefined : undefined}
                      actionType={!isOwnerView ? "link" : "button"}
                      deleteLabel={`Delete ${item.title}`}
                      onDelete={isOwnerView ? () => handleRequestDelete(item) : undefined}
                      deleteButtonRef={isOwnerView ? (node) => setDeleteButtonNode(item.id, node) : undefined}
                      deleteDisabled={deleteDisabled}
                      selected={isSelected}
                    />
                  </div>
                );
              }

              return (
                <div
                  key={item.id}
                  className={[
                    styles.selectionItem,
                    styles.listSelectionItem,
                    isSelected ? styles.selectionItemSelected : undefined,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {selectionControl}
                  <article
                    className={[styles.listRow, isSelected ? styles.listRowSelected : undefined]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className={styles.listMeta}>
                      <h3 className={styles.listTitle}>{item.title}</h3>
                      {metaParts.length > 0 ? <p className={styles.listInfo}>{metaParts.join(" • ")}</p> : null}
                    </div>
                    <div className={styles.listPoints}>{points} pts</div>
                    <div className={styles.listPrice}>{priceLabel ?? "—"}</div>
                    <div className={styles.listAction}>
                      {isOwnerView ? (
                        <div className={styles.listActionGroup}>
                          <button type="button" className={styles.inlineAction} onClick={() => handleEdit(item)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className={styles.deleteButton}
                            onClick={() => handleRequestDelete(item)}
                            ref={(node) => setDeleteButtonNode(item.id, node)}
                            aria-label={`Delete ${item.title}`}
                            disabled={deleteDisabled}
                          >
                            Delete
                          </button>
                        </div>
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
                </div>
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

      {selectionEnabled && isSelectionMode ? (
        <div
          className={styles.selectionToolbar}
          role="region"
          aria-live="polite"
          aria-label={`Bulk actions for ${selectedCount} selected ${selectedCount === 1 ? "item" : "items"}`}
        >
          <span className={styles.selectionCount}>Selected ({selectedCount})</span>
          <div className={styles.selectionActions}>
            <Button type="button" variant="secondary" onClick={clearSelection} disabled={archiveLoading}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => setConfirmArchiveOpen(true)}
              disabled={archiveLoading || selectedCount === 0}
            >
              {archiveLoading ? "Archiving…" : "Archive selected"}
            </Button>
          </div>
        </div>
      ) : null}

      {confirmArchiveOpen ? (
        <div className={styles.archiveOverlay} role="presentation" onClick={handleArchiveOverlayClick}>
          <div
            className={styles.archiveDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-dialog-title"
            aria-describedby="archive-dialog-description"
            aria-busy={archiveLoading ? "true" : undefined}
          >
            <h2 id="archive-dialog-title" className={styles.archiveDialogTitle}>
              Archive {selectedCount} {selectedCount === 1 ? "item" : "items"}?
            </h2>
            <p id="archive-dialog-description" className={styles.archiveDialogBody}>
              They’ll move out of your active list.
            </p>
            <div className={styles.archiveActions}>
              <button
                type="button"
                className={[styles.dialogButton, styles.dialogButtonSecondary].join(" ")}
                onClick={handleCancelArchive}
                ref={archiveCancelRef}
                disabled={archiveLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={[styles.dialogButton, styles.dialogButtonPrimary].join(" ")}
                onClick={() => void handleArchiveSelected()}
                ref={archiveConfirmRef}
                disabled={archiveLoading}
              >
                {archiveLoading ? "Archiving…" : "Archive"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDelete ? (
        <div className={styles.deleteOverlay} role="presentation" onClick={handleDeleteOverlayClick}>
          <div
            className={styles.deleteDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
            aria-busy={deleteLoading ? "true" : undefined}
          >
            <h2 id="delete-dialog-title" className={styles.deleteDialogTitle}>
              Remove item?
            </h2>
            <p id="delete-dialog-description" className={styles.deleteDialogBody}>
              “{pendingDelete.title}” will be removed from your wishlist.
            </p>
            <div className={styles.deleteActions}>
              <button
                type="button"
                className={[styles.dialogButton, styles.dialogButtonSecondary].join(" ")}
                onClick={handleCancelDelete}
                ref={deleteCancelRef}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={[styles.dialogButton, styles.dialogButtonDanger].join(" ")}
                onClick={() => void handleConfirmDelete()}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting…" : "Delete item"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
