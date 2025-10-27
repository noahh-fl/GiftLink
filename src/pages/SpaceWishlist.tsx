import { useCallback, useMemo, useState, type ClipboardEvent } from "react";
import { useParams } from "react-router-dom";
import "./SpaceWishlist.css";

type PeekalinkMetadata = {
  title: string | null;
  image: string | null;
  price: number | string | null;
};

type MetadataStatus = "idle" | "loading" | "success" | "error";

function normalizePriceInput(value: PeekalinkMetadata["price"]): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
}

function formatPriceDisplay(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "—";
  }

  const numeric = Number.parseFloat(trimmed.replace(/[^0-9.,]/g, "").replace(/,/g, ""));
  if (!Number.isFinite(numeric)) {
    return trimmed;
  }

  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(numeric);
}

export default function SpaceWishlist() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [metadataStatus, setMetadataStatus] = useState<MetadataStatus>("idle");
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [lastFetchedLink, setLastFetchedLink] = useState<string | null>(null);

  const shouldQueryMetadata = useCallback((candidate: string) => {
    return candidate.toLowerCase().includes("amazon.");
  }, []);

  const fetchMetadata = useCallback(
    async (candidate: string) => {
      const prepared = candidate.trim();
      if (!prepared || !shouldQueryMetadata(prepared)) {
        setMetadataStatus("idle");
        setMetadataError(null);
        return;
      }

      if (prepared === lastFetchedLink && metadataStatus === "success") {
        return;
      }

      setMetadataStatus("loading");
      setMetadataError(null);

      try {
        const response = await fetch("http://127.0.0.1:3000/metadata/peekalink", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ link: prepared }),
        });

        if (!response.ok) {
          throw new Error(`Peekalink request failed with status ${response.status}`);
        }

        const payload: PeekalinkMetadata = await response.json();

        setTitle(payload.title ?? "");
        setImageUrl(payload.image ?? "");
        setPrice(normalizePriceInput(payload.price));
        setMetadataStatus("success");
        setMetadataError(null);
        setLastFetchedLink(prepared);
      } catch (error) {
        console.error(error);
        setMetadataStatus("error");
        setMetadataError("We couldn't fetch metadata. You can continue filling fields manually.");
      }
    },
    [lastFetchedLink, metadataStatus, shouldQueryMetadata],
  );

  const handleLinkBlur = useCallback(() => {
    void fetchMetadata(link);
  }, [fetchMetadata, link]);

  const handleLinkPaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      const pasted = event.clipboardData.getData("text");
      if (!pasted) {
        return;
      }

      event.preventDefault();
      setLink(pasted);
      void fetchMetadata(pasted);
    },
    [fetchMetadata],
  );

  const statusMessage = useMemo(() => {
    if (metadataStatus === "loading") {
      return "Fetching item details…";
    }
    if (metadataStatus === "error") {
      return metadataError ?? "We couldn't fetch metadata.";
    }
    if (metadataStatus === "success") {
      return "Metadata fetched. Review and adjust before saving.";
    }
    return "Paste an Amazon link to auto-fill wishlist details.";
  }, [metadataError, metadataStatus]);

  const formattedPrice = useMemo(() => formatPriceDisplay(price), [price]);
  const hasImage = Boolean(imageUrl);
  const isLoading = metadataStatus === "loading";

  return (
    <main className="main-wishlist">
      <div className="wishlist-panel">
        <header className="wishlist-header">
          <span className="wishlist-eyebrow">My Wishlist</span>
          <h1 className="wishlist-title">Add an item</h1>
          <p className="wishlist-description">
            Paste an Amazon link to pull title, price, and imagery instantly. You can fine-tune anything before saving to your
            wishlist.
          </p>
          <p className="wishlist-description" aria-live="polite">
            Space ID: {spaceId ?? "—"}
          </p>
        </header>

        <form
          className="wishlist-form"
          aria-label="Wishlist item form"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <fieldset className="wishlist-fieldset">
            <legend className="wishlist-label">Link</legend>
            <div className="wishlist-field">
              <label className="wishlist-label" htmlFor="wishlist-link">
                Amazon URL
                <span className="wishlist-hint">Paste or type an Amazon product link</span>
              </label>
              <input
                id="wishlist-link"
                className="wishlist-input"
                name="link"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                onBlur={handleLinkBlur}
                onPaste={handleLinkPaste}
                placeholder="https://www.amazon.com/..."
                inputMode="url"
                type="url"
                autoComplete="off"
              />
            </div>
            <div className={`wishlist-status${metadataStatus === "error" ? " wishlist-status--error" : ""}`} aria-live="polite">
              {statusMessage}
            </div>
          </fieldset>

          <fieldset className="wishlist-fieldset">
            <legend className="wishlist-label">Details</legend>
            <div className="wishlist-field">
              <label className="wishlist-label" htmlFor="wishlist-title">
                Title
              </label>
              <input
                id="wishlist-title"
                className="wishlist-input"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Product name"
                autoComplete="off"
              />
            </div>

            <div className="wishlist-field">
              <label className="wishlist-label" htmlFor="wishlist-price">
                Price
                <span className="wishlist-hint">Shown to partners as guidance</span>
              </label>
              <input
                id="wishlist-price"
                className="wishlist-input"
                name="price"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="e.g. 39.99"
                inputMode="decimal"
                autoComplete="off"
              />
            </div>

            <div className="wishlist-field">
              <label className="wishlist-label" htmlFor="wishlist-image">
                Image URL
                <span className="wishlist-hint">Optional thumbnail used in the wishlist preview</span>
              </label>
              <input
                id="wishlist-image"
                className="wishlist-input"
                name="image"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://images-na.ssl-images-amazon.com/..."
                inputMode="url"
                autoComplete="off"
              />
            </div>
          </fieldset>

          <section className="wishlist-preview-grid" aria-live="polite">
            <article className="wishlist-preview-card" aria-label="Metadata preview">
              <h2 className="wishlist-preview-card-title">Preview</h2>
              <div className="wishlist-preview">
                <div className={`wishlist-preview-image${isLoading ? " wishlist-skeleton" : ""}`} aria-hidden={!hasImage}>
                  {hasImage ? (
                    <img src={imageUrl} alt={title ? `Preview of ${title}` : "Preview image"} />
                  ) : (
                    <span className="wishlist-preview-placeholder">No image yet</span>
                  )}
                </div>
                <div className="wishlist-preview-body">
                  <div
                    className={`wishlist-preview-title${isLoading ? " wishlist-skeleton wishlist-skeleton-block" : ""}`}
                  >
                    {!title && !isLoading ? "—" : title || ""}
                  </div>
                  <div
                    className={`wishlist-preview-meta${isLoading ? " wishlist-skeleton wishlist-skeleton-block" : ""}`}
                  >
                    Price: {isLoading && !price ? "" : formattedPrice}
                  </div>
                </div>
              </div>
            </article>
          </section>
        </form>
      </div>
    </main>
  );
}
