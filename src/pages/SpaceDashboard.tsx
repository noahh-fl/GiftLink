import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import Button from "../ui/components/Button";
import type { SpaceOutletContext } from "./SpaceLayout";
import SpaceDebugPanel from "./SpaceDebugPanel";
import "./SpaceDashboard.css";

type CopyState = "idle" | "copied" | "error";

export default function SpaceDashboard() {
  const { space, refreshSpace } = useOutletContext<SpaceOutletContext>();
  const navigate = useNavigate();
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    setCopyState("idle");
  }, [space.joinCode]);

  async function handleCopy() {
    if (!space.joinCode) {
      return;
    }

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
  }

  return (
    <div className="space-dashboard" aria-labelledby="space-dashboard-title">
      <section className="space-dashboard__summary">
        <header>
          <p className="space-dashboard__eyebrow">Dashboard</p>
          <h1 id="space-dashboard-title" className="space-dashboard__title">
            {space.name}
          </h1>
          {space.description ? (
            <p className="space-dashboard__description">{space.description}</p>
          ) : (
            <p className="space-dashboard__description">
              Share this join code so your partner can add wishes and rewards.
            </p>
          )}
        </header>

        <div className="space-dashboard__code">
          <div>
            <span className="space-dashboard__code-label">Join code</span>
            <span className="space-dashboard__code-value">{space.joinCode ?? ""}</span>
          </div>
          <Button type="button" variant="secondary" onClick={handleCopy}>
            {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy unavailable" : "Copy"}
          </Button>
        </div>
        {space.mode ? (
          <p className="space-dashboard__mode">Point system: {space.mode}</p>
        ) : null}
      </section>

      <section className="space-dashboard__actions" aria-label="Quick actions">
        <article className="space-dashboard__card">
          <h2>Wishlist</h2>
          <p>Add gift ideas, track prices, and keep everyone aligned on priorities.</p>
          <Button type="button" onClick={() => navigate("wishlist")}>Open wishlist</Button>
        </article>
        <article className="space-dashboard__card">
          <h2>Gift shop</h2>
          <p>Create rewards or browse your partner’s shop to spend earned points.</p>
          <Button type="button" onClick={() => navigate("shop")}>Visit shop</Button>
        </article>
      </section>

      {import.meta.env.DEV ? (
        <SpaceDebugPanel activeSpaceId={space.id} onRefresh={refreshSpace} />
      ) : null}
    </div>
  );
}
