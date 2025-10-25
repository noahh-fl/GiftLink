import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useParams } from "react-router-dom";
import ReserveButton from "../components/ReserveButton";

interface GiftResponse {
  id: number;
  name?: string | null;
  price?: number | null;
  description?: string | null;
  image?: string | null;
  reservedBy?: {
    firstName?: string | null;
  } | null;
}

interface GiftDetail extends GiftResponse {
  name: string;
  price: number | null;
  description: string | null;
  image: string | null;
}

const API_BASE_URL = "http://127.0.0.1:3000";
const BORDER_WIDTH = "calc(var(--space-1) / 4)";

const pageStyles: CSSProperties = {
  minHeight: "100vh",
  background: "var(--color-bg)",
  padding: "var(--space-6) var(--space-4)",
  display: "flex",
  justifyContent: "center",
};

const shellStyles: CSSProperties = {
  width: "100%",
  maxWidth: "calc(var(--space-12) * 18)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
};

const cardStyles: CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius-lg)",
  border: `${BORDER_WIDTH} solid var(--color-border)`,
  padding: "var(--space-6)",
  display: "grid",
  gap: "var(--space-6)",
  gridTemplateColumns: "repeat(auto-fit, minmax(calc(var(--space-12) * 6), 1fr))",
  boxShadow: "var(--elev-1)",
};

const mediaStyles: CSSProperties = {
  borderRadius: "var(--radius-lg)",
  border: `${BORDER_WIDTH} dashed var(--color-border)`,
  background: "var(--color-bg)",
  minHeight: "calc(var(--space-12) * 8)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
};

const imgStyles: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const placeholderStyles: CSSProperties = {
  fontSize: "var(--h1-size)",
  fontWeight: "var(--h1-weight)",
  color: "var(--color-text-muted)",
};

const contentStackStyles: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
};

const eyebrowStyles: CSSProperties = {
  fontSize: "var(--caption-size)",
  fontWeight: "var(--caption-weight)",
  color: "var(--color-text-muted)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const bodyTextStyles: CSSProperties = {
  margin: 0,
  color: "var(--color-text-muted)",
  lineHeight: 1.6,
};

const metaPanelStyles: CSSProperties = {
  borderRadius: "var(--radius-md)",
  border: `${BORDER_WIDTH} solid var(--color-border)`,
  padding: "var(--space-4)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
  background: "var(--color-bg)",
};

const liveRegionStyles: CSSProperties = {
  fontSize: "var(--caption-size)",
  fontWeight: "var(--caption-weight)",
  color: "var(--color-text-muted)",
};

const statusBadge = (reserved: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "calc(var(--space-1) * 1.5) var(--space-3)",
  borderRadius: "var(--radius-sm)",
  background: reserved ? "var(--color-accent-quiet)" : "var(--color-bg)",
  color: reserved ? "var(--color-accent)" : "var(--color-text-muted)",
  fontSize: "var(--caption-size)",
  fontWeight: "var(--caption-weight)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
});

const errorStyles: CSSProperties = {
  borderRadius: "var(--radius-md)",
  border: `${BORDER_WIDTH} solid var(--color-danger)`,
  background: "var(--color-surface)",
  padding: "var(--space-4)",
  color: "var(--color-danger)",
};

export default function GiftDetail() {
  const { giftId } = useParams<{ giftId: string }>();
  const [gift, setGift] = useState<GiftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Loading gift details...");
  const [reserveLoading, setReserveLoading] = useState(false);

  const numericGiftId = useMemo(() => {
    if (!giftId) return Number.NaN;
    const parsed = Number.parseInt(giftId, 10);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }, [giftId]);

  const loadGift = useCallback(
    async (options?: { signal?: AbortSignal; silent?: boolean }) => {
      if (!Number.isFinite(numericGiftId)) {
        setError("Gift id is invalid.");
        setGift(null);
        setStatusMessage("Gift id is invalid.");
        setLoading(false);
        return;
      }

      const silent = options?.silent ?? false;
      const signal = options?.signal;

      if (!silent) {
        setLoading(true);
        setStatusMessage("Loading gift details...");
      }

      setActionError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/gift/${numericGiftId}`, {
          signal,
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Unable to load gift details.");
        }

        const data = (await response.json()) as GiftResponse;
        if (signal?.aborted) return;

        const normalized: GiftDetail = {
          id: data.id,
          name: data.name?.trim() || "Untitled gift",
          price:
            typeof data.price === "number" && Number.isFinite(data.price)
              ? data.price
              : null,
          description:
            typeof data.description === "string" && data.description.trim()
              ? data.description.trim()
              : null,
          image: data.image && data.image.trim() ? data.image : null,
          reservedBy: data.reservedBy ?? null,
        };

        setGift(normalized);
        setError(null);
        setStatusMessage(`Gift ${normalized.name} is ready.`);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        const message =
          err instanceof Error ? err.message : "Unable to load gift details.";
        setGift(null);
        setError(message);
        setStatusMessage(message);
      } finally {
        if (!options?.silent && !(signal?.aborted)) {
          setLoading(false);
        }
      }
    },
    [numericGiftId]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadGift({ signal: controller.signal });
    return () => controller.abort();
  }, [loadGift]);

  const formattedPrice = useMemo(() => {
    if (!gift || gift.price === null) return null;
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(gift.price);
    } catch {
      return gift.price.toString();
    }
  }, [gift]);

  const reserved = Boolean(gift?.reservedBy);
  const reservedName = useMemo(() => {
    if (!gift?.reservedBy) return "Someone";
    const cleaned = gift.reservedBy.firstName?.trim();
    return cleaned && cleaned.length > 0 ? cleaned : "Someone";
  }, [gift]);

  async function handleReserve() {
    if (!Number.isFinite(numericGiftId)) return;
    setReserveLoading(true);
    setActionError(null);
    setStatusMessage("Reserving gift...");

    try {
      const response = await fetch(
        `${API_BASE_URL}/gift/${numericGiftId}/reserve`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Unable to reserve gift.");
      }

      await loadGift({ silent: true });
      setStatusMessage("Gift reserved.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to reserve gift.";
      setActionError(message);
      setStatusMessage(message);
    } finally {
      setReserveLoading(false);
    }
  }

  async function handleUnreserve() {
    if (!Number.isFinite(numericGiftId)) return;
    setReserveLoading(true);
    setActionError(null);
    setStatusMessage("Releasing reservation...");

    try {
      const response = await fetch(
        `${API_BASE_URL}/gift/${numericGiftId}/reserve`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Unable to unreserve gift.");
      }

      await loadGift({ silent: true });
      setStatusMessage("Reservation removed.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to unreserve gift.";
      setActionError(message);
      setStatusMessage(message);
    } finally {
      setReserveLoading(false);
    }
  }

  const reservedCopy = reserved
    ? `Reserved by ${reservedName}`
    : "Not reserved yet";

  return (
    <main style={pageStyles}>
      <div style={shellStyles}>
        <div role="status" aria-live="polite" style={liveRegionStyles}>
          {statusMessage}
        </div>

        {loading && (
          <section style={cardStyles} aria-busy="true">
            <div style={mediaStyles} aria-hidden="true" />
            <div style={contentStackStyles}>
              <span style={eyebrowStyles}>Gift</span>
              <h1>Loading...</h1>
              <p style={bodyTextStyles}>
                Hang tight while we fetch the latest details.
              </p>
            </div>
          </section>
        )}

        {!loading && error && (
          <section
            role="alert"
            aria-live="assertive"
            style={errorStyles}
          >
            {error}
          </section>
        )}

        {!loading && !error && !gift && (
          <section style={cardStyles}>
            <div style={contentStackStyles}>
              <span style={eyebrowStyles}>Gift</span>
              <h1>Gift unavailable</h1>
              <p style={bodyTextStyles}>
                We could not find this gift. It may have been removed.
              </p>
            </div>
          </section>
        )}

        {!loading && !error && gift && (
          <article className="card" style={cardStyles}>
            <div style={mediaStyles}>
              {gift.image ? (
                <img
                  src={gift.image}
                  alt={gift.name}
                  style={imgStyles}
                  loading="lazy"
                />
              ) : (
                <span style={placeholderStyles} aria-hidden="true">
                  {gift.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div style={contentStackStyles}>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <span style={eyebrowStyles}>Gift</span>
                <h1 style={{ margin: 0 }}>{gift.name}</h1>
                {formattedPrice && (
                  <p
                    style={{
                      ...bodyTextStyles,
                      fontSize: "var(--h3-size)",
                      fontWeight: "var(--h3-weight)",
                      color: "var(--color-text)",
                    }}
                  >
                    {formattedPrice}
                  </p>
                )}
              </div>

              <p style={bodyTextStyles}>
                {gift.description || "No description provided yet."}
              </p>

              <div style={metaPanelStyles}>
                <span style={statusBadge(reserved)}>{reservedCopy}</span>
                <ReserveButton
                  reserved={reserved}
                  loading={reserveLoading}
                  disabled={!gift}
                  onReserve={handleReserve}
                  onUnreserve={handleUnreserve}
                />
                {actionError && (
                  <span
                    role="alert"
                    aria-live="assertive"
                    style={{
                      fontSize: "var(--caption-size)",
                      color: "var(--color-danger)",
                    }}
                  >
                    {actionError}
                  </span>
                )}
              </div>
            </div>
          </article>
        )}
      </div>
    </main>
  );
}
