import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../ui/components/Button";
import FormField from "../ui/components/FormField";
import Input from "../ui/components/Input";
import { apiFetch } from "../utils/api";
import { useSpace } from "../contexts/SpaceContext";
import "./CreateSpace.css";

type PointMode = "price" | "sentiment";

interface CreatedSpace {
  id: number;
  name: string;
  joinCode: string;
  description?: string | null;
  mode?: string;
}

const MODE_OPTIONS: { value: PointMode; label: string; description: string }[] = [
  {
    value: "price",
    label: "Price indexed",
    description: "Points mirror the price. Great for budgeting and transparent tallies.",
  },
  {
    value: "sentiment",
    label: "Sentiment valued",
    description: "Assign points based on meaning. Perfect for couples and families.",
  },
];

export default function CreateSpace() {
  const navigate = useNavigate();
  const { setActiveSpace } = useSpace();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<PointMode | "">("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const trimmedName = name.trim();
  const trimmedDescription = description.trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");

    if (!trimmedName || !mode) {
      setError("Please provide a name and choose a point system.");
      return;
    }

    setSubmitting(true);

    const payload: Record<string, string> = {
      name: trimmedName,
      mode,
    };

    if (trimmedDescription) {
      payload.description = trimmedDescription;
    }

    try {
      const response = await apiFetch("/space", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok || !body || typeof body !== "object") {
        const message =
          body &&
          typeof (body as { message?: unknown }).message === "string" &&
          (body as { message?: string }).message
            ? ((body as { message: string }).message as string)
            : "Unable to create space.";
        throw new Error(message);
      }

      const created = body as CreatedSpace;

      setStatus("Space created. Copy the code below to invite others.");
      setActiveSpace({ id: String(created.id), name: created.name ?? trimmedName });
      navigate(`/spaces/${created.id}`);
    } catch (submitError) {
      const message =
        submitError instanceof Error && submitError.message
          ? submitError.message
          : "Unable to create space.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="create-space" aria-labelledby="create-space-title">
      <header className="create-space__header">
        <p className="create-space__eyebrow">Create</p>
        <h1 id="create-space-title" className="create-space__title">
          Spin up a new GiftLink space
        </h1>
        <p className="create-space__subtitle">
          Name your list, describe the vibe, then choose how points are tallied.
        </p>
      </header>

      <form className="create-space__form" onSubmit={handleSubmit} noValidate>
        <FormField htmlFor="space-name" label="Space name" required>
          <Input
            id="space-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Taylor & Jordan Wishlist"
            disabled={submitting}
          />
        </FormField>

        <FormField htmlFor="space-description" label="Description" hint="Optional context for your members.">
          <Input
            id="space-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Holiday planning, birthdays, and just-because treats"
            disabled={submitting}
          />
        </FormField>

        <fieldset className="create-space__mode">
          <legend className="create-space__mode-label">Point system</legend>
          <div className="create-space__mode-options">
            {MODE_OPTIONS.map((option) => (
              <label key={option.value} className={`create-space__mode-option${mode === option.value ? " create-space__mode-option--selected" : ""}`}>
                <input
                  type="radio"
                  name="point-mode"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={(event) => setMode(event.target.value as PointMode)}
                  disabled={submitting}
                />
                <span className="create-space__mode-text">
                  <span className="create-space__mode-title">{option.label}</span>
                  <span className="create-space__mode-description">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error ? (
          <p className="create-space__status create-space__status--error" role="alert">
            {error}
          </p>
        ) : null}
        {status && !error ? <p className="create-space__status">{status}</p> : null}

        <div className="create-space__actions">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create space"}
          </Button>
        </div>
      </form>
    </main>
  );
}
