import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../ui/components/Button";
import Card from "../../ui/components/Card";
import FormField from "../../ui/components/FormField";
import Input from "../../ui/components/Input";
import { useSpace } from "../../contexts/SpaceContext";
import { formatCurrency } from "../../utils/format";
import type { GiftPriority, GiftWithMeta } from "../../api/types";
import { useToast } from "../../contexts/ToastContext";
import "../../ui/styles/pages/wishlist.css";

interface DraftGift {
  name: string;
  price: string;
  category: string;
  priority: GiftPriority;
  image?: string | null;
}

const INITIAL_DRAFT: DraftGift = {
  name: "",
  price: "",
  category: "",
  priority: "medium",
  image: null,
};

async function fetchPreview(url: string): Promise<DraftGift> {
  await new Promise((resolve) => setTimeout(resolve, 350));
  try {
    const parsed = new URL(url);
    const productSlug = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() ?? "");
    const name = productSlug
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase())
      .trim();
    if (!name) {
      throw new Error("Could not parse product name");
    }
    const host = parsed.hostname.replace("www.", "");
    const category = host.includes("amazon") ? "Home" : host.includes("etsy") ? "Handmade" : "General";
    return {
      name,
      price: "",
      category,
      priority: "medium",
      image: `https://source.unsplash.com/featured/200x200?${encodeURIComponent(name)}`,
    };
  } catch (error) {
    throw new Error("Unable to fetch metadata for this link");
  }
}

function applyFilters(gifts: GiftWithMeta[], filters: Filters) {
  return gifts.filter((gift) => {
    if (filters.status !== "all" && gift.status !== filters.status) {
      return false;
    }
    if (filters.priority !== "all" && gift.priority !== filters.priority) {
      return false;
    }
    if (filters.category !== "all" && gift.category !== filters.category) {
      return false;
    }
    if (filters.price === "under-50" && (gift.price ?? 0) >= 50) {
      return false;
    }
    if (filters.price === "50-150" && ((gift.price ?? 0) < 50 || (gift.price ?? 0) > 150)) {
      return false;
    }
    if (filters.price === "over-150" && (gift.price ?? 0) <= 150) {
      return false;
    }
    return true;
  });
}

interface Filters {
  status: "all" | "wanted" | "reserved" | "purchased" | "delivered" | "received";
  priority: "all" | GiftPriority;
  category: string;
  price: "all" | "under-50" | "50-150" | "over-150";
}

export default function WishlistPage() {
  const { gifts, createGift, archiveGift, reserveGift, updateGiftPriority } = useSpace();
  const { notify } = useToast();
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<DraftGift>(INITIAL_DRAFT);
  const [manualMode, setManualMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    status: "all",
    priority: "all",
    category: "all",
    price: "all",
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    gifts.forEach((gift) => {
      if (gift.category) {
        set.add(gift.category);
      }
    });
    return Array.from(set);
  }, [gifts]);

  const filtered = useMemo(() => applyFilters(gifts, filters), [gifts, filters]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!url && !manualMode) {
      setError("Paste a valid product link to start.");
      return;
    }

    setLoading(true);
    try {
      let payload: DraftGift = draft;
      if (!manualMode) {
        payload = await fetchPreview(url);
        setDraft(payload);
        setManualMode(true);
        notify("Preview fetched. Review details before saving.");
        setLoading(false);
        return;
      }

      if (!payload.name.trim()) {
        setError("Name is required.");
        return;
      }

      const created = await createGift({
        name: payload.name,
        url: url || "https://example.com",
        price: payload.price ? Number.parseFloat(payload.price) : null,
        category: payload.category || null,
        priority: payload.priority,
        image: payload.image ?? null,
      });

      if (created) {
        setUrl("");
        setDraft(INITIAL_DRAFT);
        setManualMode(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to add gift";
      setError(message);
      setManualMode(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wishlist">
      <header className="wishlist__header">
        <div>
          <h1>My wishlist</h1>
          <p className="wishlist__subtitle">Add gifts by link or curate manually. Everyone sees the latest status.</p>
        </div>
      </header>

      <Card title="Add by URL" padding="lg">
        <form className="wishlist__form" onSubmit={handleSubmit}>
          <FormField label="Product link" htmlFor="gift-url" description="Paste any shopping link to auto-fill details.">
            <Input
              id="gift-url"
              type="url"
              placeholder="https://"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required={!manualMode}
            />
          </FormField>

          {manualMode && (
            <div className="wishlist__manual-fields">
              <FormField label="Name" htmlFor="gift-name">
                <Input
                  id="gift-name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  required
                />
              </FormField>
              <FormField label="Category" htmlFor="gift-category" optional>
                <Input
                  id="gift-category"
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                />
              </FormField>
              <FormField label="Price" htmlFor="gift-price" optional description="We'll convert the amount to points automatically.">
                <Input
                  id="gift-price"
                  type="number"
                  min="0"
                  step="1"
                  value={draft.price}
                  onChange={(event) => setDraft({ ...draft, price: event.target.value })}
                />
              </FormField>
              <FormField label="Priority" htmlFor="gift-priority">
                <div className="wishlist__priority">
                  {(["high", "medium", "low"] as GiftPriority[]).map((priority) => (
                    <label key={priority} className="wishlist__priority-option">
                      <input
                        type="radio"
                        name="gift-priority"
                        value={priority}
                        checked={draft.priority === priority}
                        onChange={() => setDraft({ ...draft, priority })}
                      />
                      <span className={`wishlist__priority-pill wishlist__priority-pill--${priority}`}>
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </span>
                    </label>
                  ))}
                </div>
              </FormField>
            </div>
          )}

          {error && <p className="wishlist__error">{error}</p>}

          <div className="wishlist__form-actions">
            <Button type="submit" variant="primary" loading={loading}>
              {manualMode ? "Save to wishlist" : "Fetch details"}
            </Button>
            {manualMode && (
              <Button type="button" variant="ghost" onClick={() => setManualMode(false)}>
                Start over
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card title="Filters" padding="md">
        <div className="wishlist__filters" role="group" aria-label="Filter wishlist">
          <div className="wishlist__filter">
            <span className="wishlist__filter-label">Status</span>
            <div className="wishlist__segmented">
              {(["all", "wanted", "reserved", "purchased", "delivered", "received"] as Filters["status"][]).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`wishlist__segment ${filters.status === status ? "wishlist__segment--active" : ""}`}
                  onClick={() => setFilters((prev) => ({ ...prev, status }))}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="wishlist__filter">
            <span className="wishlist__filter-label">Priority</span>
            <div className="wishlist__segmented">
              {(["all", "high", "medium", "low"] as const).map((priority) => (
                <button
                  key={priority}
                  type="button"
                  className={`wishlist__segment ${filters.priority === priority ? "wishlist__segment--active" : ""}`}
                  onClick={() => setFilters((prev) => ({ ...prev, priority }))}
                >
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="wishlist__filter">
            <span className="wishlist__filter-label">Category</span>
            <select
              className="wishlist__select"
              value={filters.category}
              onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
            >
              <option value="all">All</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="wishlist__filter">
            <span className="wishlist__filter-label">Price</span>
            <select
              className="wishlist__select"
              value={filters.price}
              onChange={(event) => setFilters((prev) => ({ ...prev, price: event.target.value as Filters["price"] }))}
            >
              <option value="all">All</option>
              <option value="under-50">Under 50</option>
              <option value="50-150">50 – 150</option>
              <option value="over-150">Over 150</option>
            </select>
          </div>
        </div>
      </Card>

      <section aria-label="Wishlist items" className="wishlist__grid">
        {filtered.length === 0 ? (
          <p className="wishlist__empty">No items match the current filters.</p>
        ) : (
          filtered.map((gift) => (
            <article key={gift.id} className="wishlist-card">
              <div className="wishlist-card__header">
                <h2 className="wishlist-card__title">
                  <Link to={`/gift/${gift.id}`}>{gift.name}</Link>
                </h2>
                <span className={`wishlist-card__status wishlist-card__status--${gift.status}`}>
                  {gift.status.toUpperCase()}
                </span>
              </div>
              <p className="wishlist-card__price">{formatCurrency(gift.price)}</p>
              <dl className="wishlist-card__meta">
                <div>
                  <dt>Priority</dt>
                  <dd>
                    <button
                      type="button"
                      className={`wishlist__priority-pill wishlist__priority-pill--${gift.priority}`}
                      onClick={() =>
                        updateGiftPriority(
                          gift.id,
                          gift.priority === "high" ? "medium" : gift.priority === "medium" ? "low" : "high",
                        )
                      }
                    >
                      {gift.priority.charAt(0).toUpperCase() + gift.priority.slice(1)}
                    </button>
                  </dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{gift.category ?? "—"}</dd>
                </div>
                <div>
                  <dt>Added</dt>
                  <dd>{new Date(gift.createdAt).toLocaleDateString()}</dd>
                </div>
              </dl>
              <div className="wishlist-card__actions">
                <Button variant="secondary" asChild>
                  <Link to={`/gift/${gift.id}`}>View timeline</Link>
                </Button>
                <Button variant="ghost" onClick={() => reserveGift(gift.id, "You")}>Reserve</Button>
                <Button variant="ghost" onClick={() => archiveGift(gift.id)}>Archive</Button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
