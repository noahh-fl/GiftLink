import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../utils/api";

type SpaceSummary = {
  id: number;
  name: string;
  joinCode: string;
  pointMode?: string;
  mode?: string;
};

type LoadState = "idle" | "loading" | "error" | "ready";

type CopyState = "idle" | "copied" | "error";

export default function SpaceDashboard() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const [space, setSpace] = useState<SpaceSummary | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const numericId = useMemo(() => {
    if (!spaceId) {
      return null;
    }
    const parsed = Number.parseInt(spaceId, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [spaceId]);
  const navSpaceId = space
    ? String(space.id)
    : numericId
    ? String(numericId)
    : spaceId
    ? spaceId
    : "";

  useEffect(() => {
    if (!numericId) {
      setLoadState("error");
      setErrorMessage("Space id is missing or invalid.");
      return;
    }

    let isCancelled = false;
    async function loadSpace() {
      setLoadState("loading");
      setErrorMessage("");
      try {
        const response = await apiFetch(`/spaces/${numericId}`);
        const body = await response.json().catch(() => null);

        if (!response.ok || !body || typeof body !== "object" || body === null) {
          const apiMessage =
            body &&
            typeof body === "object" &&
            body !== null &&
            "message" in body &&
            typeof (body as { message?: unknown }).message === "string"
              ? ((body as { message: string }).message || "Failed to load space.")
              : "Failed to load space.";
          throw new Error(apiMessage);
        }

        const received = (body as { space?: SpaceSummary }).space ?? (body as SpaceSummary);
        if (
          !received ||
          typeof received !== "object" ||
          typeof (received as { id?: unknown }).id !== "number" ||
          typeof (received as { joinCode?: unknown }).joinCode !== "string"
        ) {
          throw new Error("Space data is unavailable.");
        }

        if (!isCancelled) {
          setSpace(received as SpaceSummary);
          setLoadState("ready");
        }
      } catch (error) {
        if (!isCancelled) {
          setLoadState("error");
          setErrorMessage(
            error instanceof Error && error.message ? error.message : "Failed to load space.",
          );
        }
      }
    }

    loadSpace();

    return () => {
      isCancelled = true;
    };
  }, [numericId]);

  useEffect(() => {
    setCopyState("idle");
  }, [space?.joinCode]);

  const handleCopy = async () => {
    if (!space?.joinCode) {
      return;
    }

    setCopyState("idle");
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      setCopyState("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(space.joinCode);
      setCopyState("copied");
    } catch (error) {
      console.error("Unable to copy join code", error);
      setCopyState("error");
    }
  };

  return (
    <main
      style={{
        background: "var(--color-bg)",
        minHeight: "100vh",
        padding: "var(--space-6)",
        color: "var(--color-text)",
      }}
    >
      <div
        style={{
          margin: "0 auto",
          maxWidth: "720px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
        }}
      >
        <header>
          <p
            style={{
              margin: 0,
              color: "var(--color-text-muted)",
              fontSize: "var(--caption-size)",
              fontWeight: "var(--caption-weight)",
            }}
          >
            Space overview
          </p>
          <h1
            style={{
              margin: "var(--space-2) 0",
              fontSize: "var(--h2-size)",
              fontWeight: "var(--h2-weight)",
            }}
          >
            {space?.name ?? "Loading space"}
          </h1>
          {space?.pointMode || space?.mode ? (
            <p
              style={{
                margin: 0,
                color: "var(--color-text-muted)",
              }}
            >
              Point mode: {(space.pointMode ?? space.mode ?? "").toString()}
            </p>
          ) : null}
        </header>

        <section
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-5)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "var(--h3-size)",
                fontWeight: "var(--h3-weight)",
              }}
            >
              Join code
            </h2>
            <p
              style={{
                margin: "var(--space-2) 0 0",
                color: "var(--color-text-muted)",
              }}
            >
              Share this with your group so they can join the space.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-3)",
              alignItems: "center",
            }}
          >
            <code
              style={{
                fontSize: "var(--h3-size)",
                fontWeight: "var(--h3-weight)",
                background: "var(--color-accent-quiet)",
                borderRadius: "var(--radius-sm)",
                padding: "var(--space-2) var(--space-3)",
              }}
            >
              {space?.joinCode ?? "—"}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="focus-ring"
              style={{
                background: "var(--color-accent)",
                color: "var(--color-surface)",
                border: "none",
                borderRadius: "var(--radius-md)",
                padding: "0 var(--space-5)",
                height: "var(--space-12)",
                cursor: "pointer",
                fontSize: "var(--body-size)",
                fontWeight: "var(--h3-weight)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background var(--dur-med) var(--ease)",
              }}
            >
              Copy code
            </button>
            <span
              role="status"
              aria-live="polite"
              style={{ color: "var(--color-text-muted)" }}
            >
              {copyState === "copied"
                ? "Copied!"
                : copyState === "error"
                ? "Unable to copy"
                : ""}
            </span>
          </div>
        </section>

        <nav aria-label="Space navigation">
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: "var(--space-3)",
            }}
          >
            <li>
              <Link
                to={`/spaces/${navSpaceId}/wishlist`}
                className="focus-ring"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  background: "var(--color-surface)",
                  color: "var(--color-text)",
                  padding: "var(--space-4) var(--space-5)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  fontWeight: "var(--h3-weight)",
                }}
              >
                <span>Wishlist</span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
            <li>
              <Link
                to={`/spaces/${navSpaceId}/point-shop`}
                className="focus-ring"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  background: "var(--color-surface)",
                  color: "var(--color-text)",
                  padding: "var(--space-4) var(--space-5)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  fontWeight: "var(--h3-weight)",
                }}
              >
                <span>Point Shop</span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
            <li>
              <Link
                to={`/spaces/${navSpaceId}/ledger`}
                className="focus-ring"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textDecoration: "none",
                  background: "var(--color-surface)",
                  color: "var(--color-text)",
                  padding: "var(--space-4) var(--space-5)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  fontWeight: "var(--h3-weight)",
                }}
              >
                <span>Ledger</span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          </ul>
        </nav>

        {loadState === "loading" ? (
          <p role="status" aria-live="polite" style={{ color: "var(--color-text-muted)" }}>
            Loading space details…
          </p>
        ) : null}
        {loadState === "error" ? (
          <p role="alert" style={{ color: "var(--color-danger)" }}>
            {errorMessage}
          </p>
        ) : null}
      </div>
    </main>
  );
}
