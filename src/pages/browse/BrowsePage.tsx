import { Link } from "react-router-dom";
import Button from "../../ui/components/Button";
import Card from "../../ui/components/Card";
import { useSpace } from "../../contexts/SpaceContext";
import { formatCurrency } from "../../utils/format";
import "../../ui/styles/pages/browse.css";

export default function BrowsePage() {
  const { gifts, reserveGift } = useSpace();
  const available = gifts.filter((gift) => gift.status === "wanted" || gift.status === "reserved");

  return (
    <div className="browse">
      <header className="browse__header">
        <div>
          <h1>Browse partner wishlist</h1>
          <p className="browse__subtitle">Claim a surprise, coordinate timing, and jump into the gift timeline.</p>
        </div>
      </header>
      <section className="browse__grid" aria-label="Available gifts">
        {available.length === 0 ? (
          <Card title="All caught up">
            <p className="browse__empty">Nothing to browse right now. Check back after new wishlist additions.</p>
          </Card>
        ) : (
          available.map((gift) => (
            <Card
              key={gift.id}
              title={gift.name}
              action={<span className={`browse__status browse__status--${gift.status}`}>{gift.status.toUpperCase()}</span>}
            >
              <p className="browse__price">{formatCurrency(gift.price)}</p>
              <p className="browse__meta">
                {gift.category && <span>{gift.category}</span>}
                <span>{gift.priority.toUpperCase()} priority</span>
              </p>
              <div className="browse__actions">
                <Button variant="primary" onClick={() => reserveGift(gift.id, "You")}>Reserve</Button>
                <Button variant="ghost" asChild>
                  <Link to={`/gift/${gift.id}`}>View details</Link>
                </Button>
              </div>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
