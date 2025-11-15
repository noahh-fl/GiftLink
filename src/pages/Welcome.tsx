import { useNavigate } from "react-router-dom";
import Button from "../ui/components/Button";
import "./Welcome.css";

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <main className="welcome" aria-labelledby="welcome-title">
      <section className="welcome__panel">
        <p className="welcome__eyebrow">GiftLink</p>
        <h1 id="welcome-title" className="welcome__title">
          Share wishlists, earn points, stay thoughtful together.
        </h1>
        <p className="welcome__subtitle">
          A calm, guided flow for building spaces, collecting wishes, and crafting rewards you actually want.
        </p>
      </section>
      <div className="welcome__actions">
        <Button type="button" onClick={() => navigate("/signup")}>Get started</Button>
        <Button variant="secondary" type="button" onClick={() => navigate("/login")}>Sign in</Button>
      </div>
    </main>
  );
}
