import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GiftForm } from "../components/GiftForm";
import { GiftCard } from "../components/GiftCard";
import type { Gift } from "../types/gift";
import "./GiftList.css";

interface SpaceSummary {
  id: number;
  name: string;
  mode: "price" | "sentiment" | string;
}

interface PointsResponse {
  points: number;
}

export default function GiftList() {
  const { id } = useParams<{ id: string }>();
  const spaceId = useMemo(() => {
    if (!id) return NaN;
    const parsed = Number.parseInt(id, 10);
    return Number.isFinite(parsed) ? parsed : NaN;
  }, [id]);

  const [space, setSpace] = useState<SpaceSummary | null>(null);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(spaceId)) {
      setError("This space could not be found.");
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    async function fetchInitialData() {
      try {
        const [giftsData, pointsData, spacesData] = await Promise.all([
          fetchJson<Gift[]>(`http://127.0.0.1:3000/space/${spaceId}/gifts`),
          fetchJson<PointsResponse>(`http://127.0.0.1:3000/space/${spaceId}/points`),
          fetchJson<SpaceSummary[]>(`http://127.0.0.1:3000/space`),
        ]);

        if (!isMounted) return;

        setGifts(giftsData);
        setPoints(pointsData.points ?? 0);
        const matchedSpace = spacesData.find((item) => item.id === spaceId) ?? null;
        setSpace(matchedSpace);
      } catch (err) {
        if (!isMounted) return;
        const message =
          err instanceof Error && err.message ? err.message : "Unable to load gifts.";
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchInitialData();

    return () => {
      isMounted = false;
    };
  }, [spaceId]);

  if (!Number.isFinite(spaceId)) {
    return (
      <main className="gift-list">
        <div className="gift-list__container">
          <header className="gift-list__header">
            <h1 className="gift-list__title">Gift Space Not Found</h1>
            <p className="gift-list__description">
              The space identifier in the address looks invalid. Double-check the link and try again.
            </p>
            <Link className="gift-list__link" to="/">
              Back to start
            </Link>
          </header>
        </div>
      </main>
    );
  }

  const modeDescription =
    space?.mode === "price"
      ? "Points mirror the price of each gift."
      : space?.mode === "sentiment"
        ? "Points are awarded in sentiment blocks of ten."
        : "Point mode pending setup.";

  async function handleGiftCreated(gift: Gift) {
    setGifts((current) => [gift, ...current]);
  }

  async function handleGiftConfirmed(giftId: number) {
    try {
      await fetch(`http://127.0.0.1:3000/gift/${giftId}/confirm`, {
        method: "PATCH",
      });

      setGifts((current) =>
        current.map((gift) =>
          gift.id === giftId
            ? {
                ...gift,
                confirmed: true,
              }
            : gift,
        ),
      );

      const updatedPoints = await fetchJson<PointsResponse>(
        `http://127.0.0.1:3000/space/${spaceId}/points`,
      );
      setPoints(updatedPoints.points ?? 0);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Unable to confirm gift. Please retry.";
      setError(message);
    }
  }

  return (
    <main className="gift-list" aria-live="polite">
      <div className="gift-list__container">
        <header className="gift-list__header">
          <p className="gift-list__eyebrow">Gift Space</p>
          <h1 className="gift-list__title">{space?.name ?? "Shared Gifts"}</h1>
          <p className="gift-list__description">{modeDescription}</p>
          <div className="gift-list__points-card" role="status" aria-live="polite">
            <span className="gift-list__points-label">Points Bank</span>
            <strong className="gift-list__points-value">{points}</strong>
          </div>
        </header>

        <GiftForm spaceId={spaceId} onGiftCreated={handleGiftCreated} />

        {loading ? (
          <p className="gift-list__loading" role="status" aria-live="polite">
            Loading gifts…
          </p>
        ) : error ? (
          <p className="gift-list__error" role="alert">
            {error}
          </p>
        ) : gifts.length === 0 ? (
          <div className="gift-list__empty">
            <h2 className="gift-list__empty-title">No gifts yet</h2>
            <p className="gift-list__empty-copy">
              Add your first gift using the form above. It will appear here ready to confirm once it&apos;s received.
            </p>
          </div>
        ) : (
          <section className="gift-list__grid" aria-label="Gifts">
            {gifts.map((gift) => (
              <GiftCard key={gift.id} gift={gift} onConfirm={handleGiftConfirmed} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}
