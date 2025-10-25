import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { Link, useParams } from "react-router-dom";
import { GiftCard } from "../components/GiftCard";
import type { Gift } from "../types/gift";

const API_BASE_URL = "http://127.0.0.1:3000";
const BORDER_WIDTH = "calc(var(--space-1) / 4)";
const GRID_TEMPLATE = "repeat(auto-fit, minmax(calc(var(--space-12) * 5), 1fr))";
const PAGE_PADDING = "var(--space-6) var(--space-4)";
const MAX_WIDTH = "calc(var(--space-12) * 20)";
const SKELETON_ITEMS = Array.from({ length: 4 }, (_, index) => index);

interface PointsResponse {
  points: number;
}

interface SpaceResponse {
  space?: {
    name?: string | null;
  } | null;
}

type InteractionState = "idle" | "hover" | "active";

const pageStyles: CSSProperties = {
  minHeight: "100vh",
  background: "var(--color-bg)",
  padding: PAGE_PADDING,
  display: "flex",
  justifyContent: "center",
};

const containerStyles: CSSProperties = {
  width: "100%",
  maxWidth: MAX_WIDTH,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-5)",
};

const headerStyles: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-4)",
  justifyContent: "space-between",
};

const headerTextStyles: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
  flex: 1,
  minWidth: "min(100%, 32ch)",
};

const eyebrowStyles: CSSProperties = {
  margin: 0,
  fontSize: "var(--caption-size)",
  fontWeight: "var(--caption-weight)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
};

const descriptionStyles: CSSProperties = {
  margin: 0,
  color: "var(--color-text-muted)",
  maxWidth: "56ch",
};

const pointsCardStyles: CSSProperties = {
  display: "inline-flex",
  flexDirection: "column",
  gap: "var(--space-1)",
  padding: "var(--space-4) var(--space-5)",
  borderRadius: "var(--radius-md)",
  border: `${BORDER_WIDTH} solid var(--color-border)`,
  background: "var(--color-surface)",
  boxShadow: "var(--elev-1)",
  minWidth: "calc(var(--space-12) * 3)",
};

const pointsLabelStyles: CSSProperties = {
  fontSize: "var(--caption-size)",
  fontWeight: "var(--caption-weight)",
  color: "var(--color-text-muted)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const pointsValueStyles: CSSProperties = {
  fontSize: "var(--h1-size)",
  fontWeight: "var(--h1-weight)",
  color: "var(--color-text)",
  lineHeight: 1.1,
};

const liveRegionStyles: CSSProperties = {
  fontSize: "var(--caption-size)",
  fontWeight: "var(--caption-weight)",
  color: "var(--color-text-muted)",
};

const gridStyles: CSSProperties = {
  display: "grid",
  gap: "var(--space-4)",
  gridTemplateColumns: GRID_TEMPLATE,
  width: "100%",
};

const emptyStateStyles: CSSProperties = {
  borderRadius: "var(--radius-md)",
  border: `${BORDER_WIDTH} dashed var(--color-border)`,
  background: "var(--color-surface)",
  padding: "var(--space-6)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
};

const emptyCopyStyles: CSSProperties = {
  margin: 0,
  color: "var(--color-text-muted)",
};

const errorPanelStyles: CSSProperties = {
  borderRadius: "var(--radius-md)",
  border: `${BORDER_WIDTH} solid var(--color-danger)`,
  background: "var(--color-surface)",
  padding: "var(--space-5)",
  color: "var(--color-danger)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
};

const skeletonCardStyles: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
  padding: "var(--space-4)",
};

const skeletonBlockStyles: CSSProperties = {
  width: "100%",
  background: "var(--color-bg)",
  borderRadius: "var(--radius-sm)",
  minHeight: "var(--space-3)",
};

const skeletonMediaStyles: CSSProperties = {
  width: "100%",
  borderRadius: "var(--radius-md)",
  background: "var(--color-bg)",
  border: `${BORDER_WIDTH} dashed var(--color-border)`,
  aspectRatio: "5 / 3",
};

function GiftSkeleton() {
  return (
    <article className="card" style={skeletonCardStyles} aria-hidden="true">
      <div style={skeletonMediaStyles} />
      <div style={{ ...skeletonBlockStyles, minHeight: "var(--space-4)" }} />
      <div style={{ ...skeletonBlockStyles, width: "60%" }} />
      <div style={{ ...skeletonBlockStyles, minHeight: "var(--space-12)" }} />
    </article>
  );
}

export default function GiftList() {
  const { id } = useParams<{ id: string }>();
  const spaceId = useMemo(() => {
    if (!id) return Number.NaN;
    const parsed = Number.parseInt(id, 10);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }, [id]);

  const [gifts, setGifts] = useState<Gift[]>([]);
  const [spaceName, setSpaceName] = useState("");
  const [points, setPoints] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("Loading gifts...");
  const [ctaState, setCtaState] = useState<InteractionState>("idle");

  useEffect(() => {
    if (!Number.isFinite(spaceId)) {
      setError("Space id is invalid.");
      setAnnouncement("Space id is invalid.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      setAnnouncement("Loading gifts...");

      try {
        const giftsPromise = fetchJson<Gift[]>(
          `${API_BASE_URL}/space/${spaceId}/gifts`,
          controller.signal,
        );
        const pointsPromise = fetchJson<PointsResponse>(
          `${API_BASE_URL}/space/${spaceId}/points`,
          controller.signal,
        ).catch(() => null);
        const spacePromise = fetchJson<SpaceResponse>(
          `${API_BASE_URL}/spaces/${spaceId}`,
          controller.signal,
        ).catch(() => null);

        const [giftData, pointsData, spaceData] = await Promise.all([
          giftsPromise,
          pointsPromise,
          spacePromise,
        ]);

        if (!active) return;

        setGifts(giftData);
        setLoading(false);
        setAnnouncement(
          giftData.length === 0
            ? "No gifts yet. Use the Add gift button to create one."
            : `Loaded ${giftData.length} ${
                giftData.length === 1 ? "gift" : "gifts"
              }.`,
        );

        if (pointsData && Number.isFinite(pointsData.points)) {
          setPoints(pointsData.points);
        } else {
          setPoints(null);
        }

        if (spaceData?.space?.name) {
          setSpaceName(spaceData.space.name);
        }
      } catch (err) {
        if (!active) return;
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Unable to load gifts.";
        setError(message);
        setAnnouncement(message);
        setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [spaceId]);

  const handleConfirm = useCallback(
    async (giftId: number) => {
      if (!Number.isFinite(spaceId)) {
        const message = "Space id missing. Reload and try again.";
        setError(message);
        setAnnouncement(message);
        throw new Error(message);
      }

      setError(null);
      setAnnouncement("Confirming gift...");

      try {
        await fetchJson(`${API_BASE_URL}/gift/${giftId}/confirm`, undefined, {
          method: "PATCH",
        });

        setGifts((current) =>
          current.map((gift) =>
            gift.id === giftId ? { ...gift, confirmed: true } : gift,
          ),
        );

        try {
          const updatedPoints = await fetchJson<PointsResponse>(
            `${API_BASE_URL}/space/${spaceId}/points`,
          );
          if (Number.isFinite(updatedPoints.points)) {
            setPoints(updatedPoints.points);
          }
        } catch {
          // Silent failure so confirmation can still succeed.
        }

        setAnnouncement("Gift confirmed.");
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Unable to confirm gift.";
        setError(message);
        setAnnouncement(message);
        throw new Error(message);
      }
    },
    [spaceId],
  );

  const addGiftHref = Number.isFinite(spaceId)
    ? `/space/${spaceId}`
    : "/space/new";

  return (
    <main style={pageStyles}>
      <div style={containerStyles}>
        <div
          aria-live="polite"
          role={error ? "alert" : "status"}
          style={{
            ...liveRegionStyles,
            color: error ? "var(--color-danger)" : liveRegionStyles.color,
          }}
        >
          {announcement}
        </div>

        <header style={headerStyles}>
          <div style={headerTextStyles}>
            <p style={eyebrowStyles}>Space Gift List</p>
            <h1 style={{ margin: 0 }}>{spaceName || "Shared gifts"}</h1>
            <p style={descriptionStyles}>
              Track every item that has been requested inside this space. Confirm
              gifts as they arrive so everyone stays aligned.
            </p>
          </div>

          {typeof points === "number" && Number.isFinite(points) && (
            <div style={pointsCardStyles} role="status" aria-live="polite">
              <span style={pointsLabelStyles}>Points</span>
              <strong style={pointsValueStyles}>{points}</strong>
            </div>
          )}
        </header>

        {loading ? (
          <section
            style={gridStyles}
            aria-label="Loading gifts"
            aria-busy="true"
          >
            {SKELETON_ITEMS.map((item) => (
              <GiftSkeleton key={item} />
            ))}
          </section>
        ) : error ? (
          <section style={errorPanelStyles} role="alert" aria-live="assertive">
            <strong style={{ fontWeight: "var(--h3-weight)" }}>{error}</strong>
            <p style={emptyCopyStyles}>
              Check your network connection and refresh the page or try again
              later.
            </p>
          </section>
        ) : gifts.length === 0 ? (
          <section style={emptyStateStyles} aria-label="Empty gift list">
            <h2 style={{ margin: 0 }}>No gifts yet</h2>
            <p style={emptyCopyStyles}>
              Start the list so everyone knows which items still need to be
              claimed.
            </p>
            <Link
              to={addGiftHref}
              className="focus-ring"
              style={{
                background: "var(--color-accent)",
                color: "var(--color-surface)",
                borderRadius: "var(--radius-md)",
                padding: "0 var(--space-6)",
                minHeight: "var(--space-12)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "var(--body-size)",
                fontWeight: "var(--h3-weight)",
                textDecoration: "none",
                boxShadow: ctaState === "idle" ? "none" : "var(--elev-1)",
                transform:
                  ctaState === "active" ? "scale(0.98)" : "scale(1)",
                transition:
                  "box-shadow var(--dur-med) var(--ease), transform var(--dur-fast) var(--ease), background var(--dur-med) var(--ease)",
              }}
              onPointerEnter={() => setCtaState("hover")}
              onPointerLeave={() => setCtaState("idle")}
              onPointerDown={() => setCtaState("active")}
              onPointerUp={() => setCtaState("hover")}
              onBlur={() => setCtaState("idle")}
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  setCtaState("active");
                }
              }}
              onKeyUp={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  setCtaState("hover");
                }
              }}
            >
              Add gift
            </Link>
          </section>
        ) : (
          <section style={gridStyles} aria-label="Gift list">
            {gifts.map((gift) => (
              <GiftCard key={gift.id} gift={gift} onConfirm={handleConfirm} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

async function fetchJson<T>(
  url: string,
  signal?: AbortSignal,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, { signal, ...init });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const data = (await response.json()) as { message?: string };
      if (data?.message) {
        message = data.message;
      }
    } catch {
      // no-op
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}
