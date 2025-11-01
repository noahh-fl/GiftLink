import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import ErrorBoundary from "../components/ErrorBoundary";
import Button from "../ui/components/Button";
import { apiFetch } from "../utils/api";
import { useSpace } from "../contexts/SpaceContext";
import "./SpaceLayout.css";

type LoadState = "idle" | "loading" | "error" | "ready";

export interface SpaceDetails {
  id: number;
  name: string;
  description: string | null;
  joinCode: string;
  inviteCode?: string;
  mode?: string;
}

export interface SpaceOutletContext {
  space: SpaceDetails;
  refreshSpace: () => Promise<void>;
}

export default function SpaceLayout() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const navigate = useNavigate();
  const { setActiveSpace } = useSpace();

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [space, setSpace] = useState<SpaceDetails | null>(null);
  const [error, setError] = useState("");

  const numericSpaceId = useMemo(() => {
    const parsed = Number.parseInt(spaceId ?? "", 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [spaceId]);

  const fetchSpace = useCallback(async () => {
    if (numericSpaceId === null) {
      setError("Space id is invalid.");
      setLoadState("error");
      return;
    }

    setLoadState((previous) => (previous === "ready" ? previous : "loading"));
    setError("");

    try {
      const response = await apiFetch(`/spaces/${numericSpaceId}`);
      const body = await response.json().catch(() => null);

      if (!response.ok || !body || typeof body !== "object") {
        const message =
          body &&
          typeof (body as { message?: unknown }).message === "string" &&
          (body as { message?: string }).message
            ? ((body as { message: string }).message as string)
            : "Unable to load space.";
        throw new Error(message);
      }

      const payload = (body as { space?: SpaceDetails }).space ?? (body as SpaceDetails);

      if (!payload || typeof payload.id !== "number") {
        throw new Error("Space data is incomplete.");
      }

      setSpace({
        id: payload.id,
        name: payload.name ?? "Untitled space",
        description: payload.description ?? null,
        joinCode: payload.joinCode ?? "",
        inviteCode: payload.inviteCode,
        mode: payload.mode,
      });
      setActiveSpace({ id: String(payload.id), name: payload.name ?? "Untitled space" });
      setLoadState("ready");
    } catch (loadError) {
      const message =
        loadError instanceof Error && loadError.message
          ? loadError.message
          : "Unable to load space.";
      setError(message);
      setLoadState("error");
    }
  }, [numericSpaceId, setActiveSpace]);

  useEffect(() => {
    void fetchSpace();
  }, [fetchSpace]);

  const navItems = useMemo(
    () => [
      { to: ".", label: "Dashboard", end: true },
      { to: "wishlist", label: "Wishlist" },
      { to: "shop", label: "Gift shop" },
      { to: "inbox", label: "Inbox" },
    ],
    [],
  );

  const isSpaceIdInvalid = numericSpaceId === null;

  return (
    <div className="space-layout">
      <header className="space-layout__header">
        <nav aria-label="Space">
          <ul className="space-layout__nav" role="list">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    ["space-layout__nav-link", isActive ? "space-layout__nav-link--active" : ""]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="space-layout__main" aria-live="polite">
        {loadState === "loading" ? (
          <div className="space-layout__status">Loading space…</div>
        ) : null}
        {loadState === "error" ? (
          <div className="space-layout__status space-layout__status--error">
            <p>{error}</p>
            <div className="space-layout__error-actions">
              <Button type="button" variant="secondary" onClick={() => fetchSpace()}>
                Retry
              </Button>
              {isSpaceIdInvalid ? (
                <Button type="button" onClick={() => navigate("/")}>
                  Back to dashboard
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        {loadState === "ready" && space ? (
          <ErrorBoundary
            resetKeys={[space.id, loadState]}
            fallback={({ reset }) => (
              <div className="space-layout__status space-layout__status--error">
                <p>Something went wrong. Please try again.</p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    reset();
                    void fetchSpace();
                  }}
                >
                  Retry
                </Button>
              </div>
            )}
          >
            <Outlet context={{ space, refreshSpace: fetchSpace }} />
          </ErrorBoundary>
        ) : null}
      </main>
    </div>
  );
}
