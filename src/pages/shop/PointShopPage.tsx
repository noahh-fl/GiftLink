import type { FormEvent } from "react";
import { useState } from "react";
import Button from "../../ui/components/Button";
import Card from "../../ui/components/Card";
import FormField from "../../ui/components/FormField";
import Input from "../../ui/components/Input";
import { useSpace } from "../../contexts/SpaceContext";
import { formatDate } from "../../utils/format";
import "../../ui/styles/pages/shop.css";

interface RewardDraft {
  title: string;
  description: string;
  cost: string;
  stock: string;
  expiresAt: string;
}

const INITIAL_REWARD: RewardDraft = {
  title: "",
  description: "",
  cost: "",
  stock: "",
  expiresAt: "",
};

export default function PointShopPage() {
  const { rewards, redemptions, createReward, redeemReward, activeSpace } = useSpace();
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<RewardDraft>(INITIAL_REWARD);

  function resetForm() {
    setDraft(INITIAL_REWARD);
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title || !draft.cost) {
      return;
    }
    createReward({
      title: draft.title,
      description: draft.description,
      cost: Number.parseInt(draft.cost, 10),
      stock: draft.stock ? Number.parseInt(draft.stock, 10) : undefined,
      expiresAt: draft.expiresAt || undefined,
    });
    resetForm();
    setModalOpen(false);
  }

  return (
    <div className="shop">
      <header className="shop__header">
        <div>
          <h1>Point shop</h1>
          <p className="shop__subtitle">Trade earned points for meaningful rewards you create together.</p>
        </div>
        <div className="shop__header-actions">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Create reward
          </Button>
          <span className="shop__balance">{activeSpace?.points ?? 0} pts</span>
        </div>
      </header>

      <section className="shop__grid" aria-label="Rewards">
        {rewards.length === 0 ? (
          <Card title="No rewards yet">
            <p className="shop__empty">Use “Create reward” to add experiences or treats.</p>
          </Card>
        ) : (
          rewards.map((reward) => (
            <Card
              key={reward.id}
              title={reward.title}
              action={<span className="shop__cost">{reward.cost} pts</span>}
            >
              <p className="shop__description">{reward.description}</p>
              <p className="shop__meta">
                <span>Created by {reward.createdBy}</span>
                {typeof reward.remaining === "number" && (
                  <span>
                    {reward.remaining} of {reward.stock} left
                  </span>
                )}
                {reward.expiresAt && <span>Expires {formatDate(reward.expiresAt)}</span>}
              </p>
              <div className="shop__actions">
                <Button variant="primary" onClick={() => redeemReward(reward.id, "You")}>
                  Redeem
                </Button>
              </div>
            </Card>
          ))
        )}
      </section>

      <Card title="My redemptions" padding="lg">
        {redemptions.length === 0 ? (
          <p className="shop__empty">Redemptions will show here once you spend points.</p>
        ) : (
          <ul className="shop__redemptions">
            {redemptions.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.rewardTitle}</strong>
                  <span className="shop__redemption-meta">
                    {entry.spent} pts · {formatDate(entry.redeemedAt)}
                  </span>
                </div>
                <span className={`shop__status shop__status--${entry.status}`}>{entry.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {modalOpen && (
        <div className="shop__modal" role="dialog" aria-modal="true" aria-labelledby="create-reward-heading">
          <div className="shop__modal-content">
            <header className="shop__modal-header">
              <h2 id="create-reward-heading">Create reward</h2>
              <button type="button" className="shop__modal-close" onClick={() => setModalOpen(false)} aria-label="Close">
                ×
              </button>
            </header>
            <form className="shop__modal-form" onSubmit={handleCreate}>
              <FormField label="Title" htmlFor="reward-title">
                <Input
                  id="reward-title"
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                  required
                />
              </FormField>
              <FormField label="Description" htmlFor="reward-description" optional>
                <textarea
                  id="reward-description"
                  className="shop__textarea"
                  value={draft.description}
                  onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                />
              </FormField>
              <FormField label="Point cost" htmlFor="reward-cost">
                <Input
                  id="reward-cost"
                  type="number"
                  min="1"
                  value={draft.cost}
                  onChange={(event) => setDraft((prev) => ({ ...prev, cost: event.target.value }))}
                  required
                />
              </FormField>
              <FormField label="Stock" htmlFor="reward-stock" optional>
                <Input
                  id="reward-stock"
                  type="number"
                  min="1"
                  value={draft.stock}
                  onChange={(event) => setDraft((prev) => ({ ...prev, stock: event.target.value }))}
                />
              </FormField>
              <FormField label="Expires on" htmlFor="reward-expires" optional>
                <Input
                  id="reward-expires"
                  type="date"
                  value={draft.expiresAt}
                  onChange={(event) => setDraft((prev) => ({ ...prev, expiresAt: event.target.value }))}
                />
              </FormField>
              <div className="shop__modal-actions">
                <Button type="submit" variant="primary">
                  Create
                </Button>
                <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
