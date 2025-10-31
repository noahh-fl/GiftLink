import { useState } from "react";
import Button from "../ui/components/Button";
import { apiFetch } from "../utils/api";
import "./SpaceDebugPanel.css";

interface DebugSpaceSummary {
  id: number;
  name: string;
  joinCode?: string;
  createdAt?: string;
  mode?: string;
  description?: string | null;
}

interface SpaceDebugPanelProps {
  activeSpaceId: number;
  onRefresh: () => Promise<void>;
}

export default function SpaceDebugPanel({ activeSpaceId, onRefresh }: SpaceDebugPanelProps) {
  const [spaces, setSpaces] = useState<DebugSpaceSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [details, setDetails] = useState<DebugSpaceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  if (!import.meta.env.DEV) {
    return null;
  }

  async function listSpaces() {
    setLoading(true);
    setError("");
    setStatus("Loading spaces…");

    try {
      const response = await apiFetch("/space");
      const body = await response.json().catch(() => null);

      if (!response.ok || !Array.isArray(body)) {
        throw new Error("Unable to load spaces.");
      }

      setSpaces(body as DebugSpaceSummary[]);
      setStatus(`Loaded ${body.length} space${body.length === 1 ? "" : "s"}.`);
    } catch (loadError) {
      const message =
        loadError instanceof Error && loadError.message ? loadError.message : "Unable to load spaces.";
      setError(message);
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  async function createQuickSpace() {
    setLoading(true);
    setError("");
    setStatus("Creating demo space…");

    try {
      const label = new Date().toLocaleTimeString();
      const response = await apiFetch("/space", {
        method: "POST",
        body: JSON.stringify({ name: `Dev Space ${label}`, mode: "price" }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok || !body || typeof body !== "object") {
        throw new Error("Unable to create space.");
      }

      setStatus("Space created. Refreshing list…");
      await listSpaces();
    } catch (creationError) {
      const message =
        creationError instanceof Error && creationError.message
          ? creationError.message
          : "Unable to create space.";
      setError(message);
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  async function viewSpaceDetail(id: number) {
    setLoading(true);
    setError("");
    setStatus("Loading details…");

    try {
      const response = await apiFetch(`/spaces/${id}`);
      const body = await response.json().catch(() => null);

      if (!response.ok || !body || typeof body !== "object") {
        throw new Error("Unable to load space details.");
      }

      const payload = (body as { space?: DebugSpaceSummary }).space ?? (body as DebugSpaceSummary);
      setDetails(payload);
      setSelectedId(id);
      setStatus("Details loaded.");
    } catch (loadError) {
      const message =
        loadError instanceof Error && loadError.message
          ? loadError.message
          : "Unable to load space details.";
      setError(message);
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="debug-panel" aria-label="Development helpers">
      <header className="debug-panel__header">
        <div>
          <p className="debug-panel__eyebrow">Developer</p>
          <h2 className="debug-panel__title">Debug panel</h2>
        </div>
        <div className="debug-panel__cta">
          <Button type="button" variant="secondary" onClick={() => void onRefresh()}>
            Refresh active space
          </Button>
        </div>
      </header>

      <div className="debug-panel__actions">
        <Button type="button" onClick={() => void listSpaces()} disabled={loading}>
          List spaces
        </Button>
        <Button type="button" variant="secondary" onClick={() => void createQuickSpace()} disabled={loading}>
          Quick create
        </Button>
      </div>

      {status ? <p className="debug-panel__status">{status}</p> : null}
      {error ? (
        <p className="debug-panel__status debug-panel__status--error" role="alert">
          {error}
        </p>
      ) : null}

      {spaces.length > 0 ? (
        <div className="debug-panel__list">
          <h3>Spaces</h3>
          <ul>
            {spaces.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void viewSpaceDetail(item.id)}
                  className={selectedId === item.id ? "debug-panel__list-button debug-panel__list-button--active" : "debug-panel__list-button"}
                >
                  <span>{item.name}</span>
                  <span>#{item.id}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {details ? (
        <div className="debug-panel__details">
          <h3>Space detail</h3>
          <dl>
            <div>
              <dt>ID</dt>
              <dd>{details.id}</dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>{details.name}</dd>
            </div>
            {details.joinCode ? (
              <div>
                <dt>Join code</dt>
                <dd>{details.joinCode}</dd>
              </div>
            ) : null}
            {details.mode ? (
              <div>
                <dt>Mode</dt>
                <dd>{details.mode}</dd>
              </div>
            ) : null}
            {details.description ? (
              <div>
                <dt>Description</dt>
                <dd>{details.description}</dd>
              </div>
            ) : null}
          </dl>
          <pre className="debug-panel__json" aria-label="Raw JSON">{JSON.stringify(details, null, 2)}</pre>
        </div>
      ) : null}

      <footer className="debug-panel__footer">
        <p>
          Active space: <span>#{activeSpaceId}</span>
        </p>
      </footer>
    </section>
  );
}
