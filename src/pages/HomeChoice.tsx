import { Link } from "react-router-dom";
import "./HomeChoice.css";

export default function HomeChoice() {
  return (
    <main className="home-choice">
      <section
        className="home-choice__container"
        aria-labelledby="home-choice-heading"
      >
        <header className="home-choice__header">
          <p className="home-choice__eyebrow">GiftLink Spaces</p>
          <h1 id="home-choice-heading" className="home-choice__title">
            Choose how you want to start
          </h1>
          <p className="home-choice__description">
            Create a brand-new shared wishlist or join an active space with an
            invite code. Every option keeps GiftLink&apos;s point magic intact.
          </p>
        </header>

        <div className="home-choice__actions">
          <Link
            to="/space/new"
            className="home-choice__action home-choice__action--primary"
          >
            <span className="home-choice__action-label">Create New List</span>
            <span className="home-choice__action-copy">
              Start fresh, pick your point rules, and invite your people.
            </span>
          </Link>

          <Link
            to="/space/join"
            className="home-choice__action home-choice__action--secondary"
          >
            <span className="home-choice__action-label">Join Active List</span>
            <span className="home-choice__action-copy">
              Already invited? Enter your code and jump into the space.
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
