import { useNavigate } from "react-router-dom";
import Button from "../ui/components/Button";
import "./StartFlow.css";

export default function StartFlow() {
  const navigate = useNavigate();

  return (
    <main className="start-flow" aria-labelledby="start-title">
      <header className="start-flow__header">
        <p className="start-flow__eyebrow">Begin</p>
        <h1 id="start-title" className="start-flow__title">
          How would you like to jump in?
        </h1>
        <p className="start-flow__subtitle">
          Create a new space for your crew or join one that already exists.
        </p>
      </header>

      <div className="start-flow__options" role="list">
        <article className="start-flow__option" role="listitem">
          <h2 className="start-flow__option-title">Create a space</h2>
          <p className="start-flow__option-body">
            Name your shared space, set the point system, and invite others with a code.
          </p>
          <Button type="button" onClick={() => navigate("/start/create")}>Create list</Button>
        </article>

        <article className="start-flow__option" role="listitem">
          <h2 className="start-flow__option-title">Join with a code</h2>
          <p className="start-flow__option-body">
            Enter a join code shared by your partner or teammate to access their space.
          </p>
          <Button type="button" variant="secondary" onClick={() => navigate("/start/join")}>Join a space</Button>
        </article>
      </div>
    </main>
  );
}
