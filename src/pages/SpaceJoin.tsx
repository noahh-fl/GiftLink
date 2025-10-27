import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import JoinCodeInput, { validateJoinCode } from "../components/JoinCodeInput";
import Button from "../ui/components/Button";
import { useToast } from "../contexts/ToastContext";
import { useSpace } from "../contexts/SpaceContext";
import { apiFetch } from "../utils/api";
import "./SpaceJoin.css";

type Status =
  | { type: "idle" }
  | { type: "info"; message: string }
  | { type: "error"; message: string };

export default function SpaceJoin() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { setActiveSpace } = useSpace();
  const [inviteCode, setInviteCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const validation = validateJoinCode(inviteCode);
  const inlineError = touched && !validation.isValid ? validation.message : "";
  const statusId = status.type !== "idle" ? "space-join-status" : undefined;

  function handleCodeChange(nextValue: string) {
    if (status.type !== "idle") setStatus({ type: "idle" });
    setInviteCode(nextValue);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);

    if (!validation.isValid) return;

    setLoading(true);
    setStatus({ type: "info", message: "Checking invite code..." });

    const cleaned = validation.cleaned;

    try {
      const response = await apiFetch("/space/join", {
        method: "POST",
        body: JSON.stringify({ code: cleaned }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          body && typeof body === "object" && "message" in body && typeof (body as any).message === "string"
            ? (body as any).message
            : "We couldn't find that invite.";
        throw new Error(message);
      }

      const space =
        body && typeof body === "object" && "space" in body
          ? (body as { space: { id?: unknown; name?: unknown } }).space
          : (body as { id?: unknown; name?: unknown });

      const spaceId =
        space && typeof space === "object" && "id" in space && typeof (space as any).id === "string"
          ? (space as any).id
          : typeof (space as any)?.id === "number"
          ? String((space as any).id)
          : cleaned;

      const spaceName =
        space && typeof space === "object" && "name" in space && typeof (space as any).name === "string"
          ? (space as any).name
          : "";

      setActiveSpace({ id: spaceId, name: spaceName });
      showToast({ intent: "success", description: "Joined space. Redirecting to dashboard." });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : "Unable to join that space.";
      setStatus({ type: "error", message });
      showToast({ intent: "error", description: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-join">
      <section className="space-join__panel" aria-labelledby="space-join-heading">
        <header className="space-join__header">
          <p className="space-join__eyebrow">GiftLink Spaces</p>
          <h1 id="space-join-heading" className="space-join__title">
            Join an existing space
          </h1>
          <p className="space-join__subtitle">
            Enter the invite code that was shared with you. We'll verify it and redirect you to the
            dashboard.
          </p>
        </header>

        <form className="space-join__form" onSubmit={handleSubmit} noValidate aria-describedby={statusId}>
          <JoinCodeInput
            value={inviteCode}
            onChange={handleCodeChange}
            onBlur={() => setTouched(true)}
            disabled={loading}
            error={inlineError}
          />

          <div className="space-join__actions">
            <Button type="submit" disabled={loading || !validation.isValid} aria-busy={loading || undefined}>
              {loading ? "Checking…" : "Continue"}
            </Button>
          </div>

          {status.type !== "idle" && (
            <p
              id={statusId}
              className={`space-join__status${status.type === "error" ? " space-join__status--error" : ""}`}
              role={status.type === "error" ? "alert" : "status"}
              aria-live="polite"
            >
              {status.message}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
