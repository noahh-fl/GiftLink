import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../ui/components/Button";
import FormField from "../ui/components/FormField";
import Input from "../ui/components/Input";
import { apiFetch } from "../utils/api";
import { useSpace } from "../contexts/SpaceContext";
import "./JoinSpace.css";

interface JoinedSpaceResponse {
  id: number;
  name?: string;
}

export default function JoinSpace() {
  const navigate = useNavigate();
  const { setActiveSpace } = useSpace();

  const [code, setCode] = useState("");
  const [status, setStatus] = useState("Enter the 6–8 character code shared with you.");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmedCode = code.trim().toUpperCase();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("Checking code…");

    if (!trimmedCode) {
      setError("Enter a join code to continue.");
      setStatus("Enter the 6–8 character code shared with you.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiFetch("/spaces/join", {
        method: "POST",
        body: JSON.stringify({ code: trimmedCode }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok || !body || typeof body !== "object") {
        const message =
          body &&
          typeof (body as { message?: unknown }).message === "string" &&
          (body as { message?: string }).message
            ? ((body as { message: string }).message as string)
            : "Unable to join space.";
        throw new Error(message);
      }

      const joined = body as JoinedSpaceResponse;
      setStatus("Success! Redirecting you to the dashboard.");
      setActiveSpace({ id: String(joined.id), name: joined.name ?? "" });
      navigate(`/spaces/${joined.id}`);
    } catch (joinError) {
      const message =
        joinError instanceof Error && joinError.message
          ? joinError.message
          : "Unable to join space.";
      setError(message);
      setStatus("Enter the 6–8 character code shared with you.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="join-space" aria-labelledby="join-space-title">
      <header className="join-space__header">
        <p className="join-space__eyebrow">Join</p>
        <h1 id="join-space-title" className="join-space__title">
          Enter a join code
        </h1>
        <p className="join-space__subtitle">
          Codes use only letters and numbers. They are not case-sensitive.
        </p>
      </header>

      <form className="join-space__form" onSubmit={handleSubmit} noValidate>
        <FormField
          htmlFor="join-code"
          label="Join code"
          hint="Paste or type the code you received. We’ll take care of the rest."
          required
        >
          <Input
            id="join-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="ALPHA42"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            disabled={submitting}
          />
        </FormField>

        {error ? (
          <p className="join-space__status join-space__status--error" role="alert">
            {error}
          </p>
        ) : (
          <p className="join-space__status">{status}</p>
        )}

        <div className="join-space__actions">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Joining…" : "Join space"}
          </Button>
        </div>
      </form>
    </main>
  );
}
