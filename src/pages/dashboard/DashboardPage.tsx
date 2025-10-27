import { Link } from "react-router-dom";
import Card from "../../ui/components/Card";
import Button from "../../ui/components/Button";
import { useSpace } from "../../contexts/SpaceContext";
import { formatCurrency, formatDateTime } from "../../utils/format";
import "../../ui/styles/pages/dashboard.css";

export default function DashboardPage() {
  const { activeSpace, gifts, ledger, loading } = useSpace();
  const points = activeSpace?.points ?? 0;
  const recentGifts = gifts.slice(0, 3);
  const recentLedger = ledger.slice(0, 5);

  return (
    <div className="dashboard" aria-live="polite">
      <div className="dashboard__intro">
        <div>
          <h1>Dashboard</h1>
          <p className="dashboard__subtitle">
            Welcome back! Track wishlist momentum, confirm gifts, and see how your points are trending.
          </p>
        </div>
        <Button asChild variant="primary">
          <Link to="/wishlist">Add to wishlist</Link>
        </Button>
      </div>
      <div className="dashboard__grid">
        <Card title="Points" padding="lg">
          {loading ? (
            <div className="dashboard__skeleton" aria-hidden="true" />
          ) : (
            <div className="dashboard__points">
              <strong>{points}</strong>
              <span>available points</span>
            </div>
          )}
          <div className="dashboard__actions">
            <Button variant="secondary" asChild>
              <Link to="/shop">Redeem rewards</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/ledger">View ledger</Link>
            </Button>
          </div>
        </Card>

        <Card title="Recent wishlist" action={<Link to="/wishlist">View all</Link>}>
          {recentGifts.length === 0 ? (
            <p className="dashboard__empty">No wishlist items yet. Try adding your first one!</p>
          ) : (
            <ul className="dashboard__list" aria-label="Recent gifts">
              {recentGifts.map((gift) => (
                <li key={gift.id} className="dashboard__list-item">
                  <div>
                    <Link to={`/gift/${gift.id}`} className="dashboard__item-link">
                      {gift.name}
                    </Link>
                    <span className="dashboard__meta">{gift.status.toUpperCase()}</span>
                  </div>
                  <span>{formatCurrency(gift.price)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Ledger" action={<Link to="/ledger">Open ledger</Link>}>
          {recentLedger.length === 0 ? (
            <p className="dashboard__empty">Your ledger entries will appear as you earn and spend points.</p>
          ) : (
            <ul className="dashboard__list" aria-label="Recent ledger entries">
              {recentLedger.map((entry) => (
                <li key={entry.id} className="dashboard__list-item dashboard__list-item--ledger">
                  <div>
                    <span className="dashboard__ledger-amount" data-type={entry.type}>
                      {entry.type === "earn" ? "+" : "-"}
                      {entry.amount} pts
                    </span>
                    <p className="dashboard__ledger-description">{entry.description}</p>
                  </div>
                  <span className="dashboard__meta">{formatDateTime(entry.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
