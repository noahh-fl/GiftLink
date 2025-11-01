import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Button from "../ui/components/Button";
import Input from "../ui/components/Input";
import { apiFetch } from "../utils/api";
import {
  getCurrentUserId,
  listTestUsers,
  setCurrentUserId,
  subscribeToUserChanges,
} from "../utils/user";
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

interface ParsedGiftSample {
  title: string | null;
  price: number | null;
  imageUrl: string | null;
}

interface RewardProbeItem {
  id: number;
  title: string;
  points: number;
  userId?: string;
}

export default function SpaceDebugPanel({ activeSpaceId, onRefresh }: SpaceDebugPanelProps) {
  const [spaces, setSpaces] = useState<DebugSpaceSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [details, setDetails] = useState<DebugSpaceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [parseUrl, setParseUrl] = useState("");
  const [parseResult, setParseResult] = useState<ParsedGiftSample | null>(null);
  const [parseStatus, setParseStatus] = useState("");
  const [parseError, setParseError] = useState("");
  const [parseLoading, setParseLoading] = useState(false);
  const [probeSpace, setProbeSpace] = useState("");
  const [probeRewards, setProbeRewards] = useState<RewardProbeItem[]>([]);
  const [probeError, setProbeError] = useState("");
  const [probeStatus, setProbeStatus] = useState("");
  const [probeLoading, setProbeLoading] = useState(false);
  const testers = useMemo(() => listTestUsers(), []);
  const [activeTester, setActiveTester] = useState<string>(() => getCurrentUserId());

  const spaceOptions = useMemo(() => spaces.map((item) => ({ id: item.id, name: item.name })), [spaces]);

  if (!import.meta.env.DEV) {
    return null;
  }

  useEffect(() => {
    const unsubscribe = subscribeToUserChanges((identity) => {
      setActiveTester(identity.id);
    });
    return unsubscribe;
  }, []);

  function handleTesterChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    setCurrentUserId(next);
    setActiveTester(next);
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

  async function runParseTester() {
    const trimmed = parseUrl.trim();
    if (!trimmed) {
      setParseError("Enter a URL to parse.");
      setParseStatus("");
      setParseResult(null);
      return;
    }

    setParseLoading(true);
    setParseError("");
    setParseStatus("Parsing…");
    setParseResult(null);

    try {
      const response = await apiFetch("/gifts/parse", {
        method: "POST",
        body: JSON.stringify({ url: trimmed }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok || !body || typeof body !== "object") {
        const message =
          body && typeof (body as { message?: string }).message === "string"
            ? (body as { message: string }).message
            : "Unable to parse link.";
        throw new Error(message);
      }

      setParseResult(body as ParsedGiftSample);
      setParseStatus("Parse complete.");
    } catch (parseErr) {
      const message =
        parseErr instanceof Error && parseErr.message ? parseErr.message : "Unable to parse link.";
      setParseError(message);
      setParseStatus("");
    } finally {
      setParseLoading(false);
    }
  }

  async function runRewardsProbe() {
    const numeric = Number.parseInt(probeSpace, 10);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setProbeError("Choose a valid space.");
      setProbeStatus("");
      setProbeRewards([]);
      return;
    }

    setProbeLoading(true);
    setProbeError("");
    setProbeStatus("Loading rewards…");
    setProbeRewards([]);

    try {
      const response = await apiFetch(`/spaces/${numeric}/rewards`);
      const body = await response.json().catch(() => null);

      if (!response.ok || !body || typeof body !== "object") {
        throw new Error("Unable to load rewards for probe.");
      }

      const payload = (body as { rewards?: RewardProbeItem[] }).rewards ?? [];
      setProbeRewards(
        payload.map((reward) => ({
          id: reward.id,
          title: reward.title,
          points: reward.points,
          userId: reward.userId ?? (reward as { ownerKey?: string }).ownerKey,
        })),
      );
      setProbeStatus(`Loaded ${payload.length} reward${payload.length === 1 ? "" : "s"}.`);
    } catch (probeErr) {
      const message =
        probeErr instanceof Error && probeErr.message
          ? probeErr.message
          : "Unable to load rewards for probe.";
      setProbeError(message);
      setProbeStatus("");
    } finally {
      setProbeLoading(false);
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

      <div className="debug-panel__tester">
        <label className="debug-panel__tester-label" htmlFor="debug-active-tester">
          Active tester
        </label>
        <select
          id="debug-active-tester"
          className="debug-panel__tester-select"
          value={activeTester}
          onChange={handleTesterChange}
        >
          {testers.map((tester) => (
            <option key={tester} value={tester}>
              {tester}
            </option>
          ))}
        </select>
        <p className="debug-panel__tester-caption">
          Requests now send as <span>{activeTester}</span>.
        </p>
      </div>

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
                  className={
                    selectedId === item.id
                      ? "debug-panel__list-button debug-panel__list-button--active"
                      : "debug-panel__list-button"
                  }
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

      <div className="debug-panel__probes">
        <div className="debug-panel__probe">
          <h3>Parse tester</h3>
          <div className="debug-panel__probe-controls">
            <Input
              value={parseUrl}
              onChange={(event) => setParseUrl(event.target.value)}
              placeholder="https://www.amazon.com/..."
              disabled={parseLoading}
            />
            <Button type="button" variant="secondary" onClick={() => void runParseTester()} disabled={parseLoading}>
              {parseLoading ? "Parsing…" : "Run"}
            </Button>
          </div>
          {parseStatus ? <p className="debug-panel__probe-status">{parseStatus}</p> : null}
          {parseError ? (
            <p className="debug-panel__probe-status debug-panel__probe-status--error" role="alert">
              {parseError}
            </p>
          ) : null}
          {parseResult ? (
            <pre className="debug-panel__json" aria-label="Parse result">{JSON.stringify(parseResult, null, 2)}</pre>
          ) : null}
        </div>

        <div className="debug-panel__probe">
          <h3>Rewards probe</h3>
          <div className="debug-panel__probe-controls">
            <select
              className="debug-panel__select"
              value={probeSpace}
              onChange={(event) => setProbeSpace(event.target.value)}
              disabled={probeLoading}
            >
              <option value="">Select a space…</option>
              {spaceOptions.map((spaceOption) => (
                <option key={spaceOption.id} value={spaceOption.id}>
                  #{spaceOption.id} · {spaceOption.name}
                </option>
              ))}
            </select>
            <Button type="button" variant="secondary" onClick={() => void runRewardsProbe()} disabled={probeLoading}>
              {probeLoading ? "Loading…" : "Fetch"}
            </Button>
          </div>
          {probeStatus ? <p className="debug-panel__probe-status">{probeStatus}</p> : null}
          {probeError ? (
            <p className="debug-panel__probe-status debug-panel__probe-status--error" role="alert">
              {probeError}
            </p>
          ) : null}
          {probeRewards.length > 0 ? (
            <ul className="debug-panel__probe-list">
              {probeRewards.map((reward) => (
                <li key={reward.id}>
                  <span>{reward.title}</span>
                  <span>
                    {reward.points} pts · {reward.userId ?? "unknown"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <footer className="debug-panel__footer">
        Active space: <span>{activeSpaceId}</span>
      </footer>
    </section>
  );
}
