import Card from "../../ui/components/Card";
import Button from "../../ui/components/Button";
import { useSpace } from "../../contexts/SpaceContext";
import { formatDate } from "../../utils/format";
import "../../ui/styles/pages/settings.css";

export default function SettingsPage() {
  const { activeSpace, refreshSpace } = useSpace();

  if (!activeSpace) {
    return (
      <div className="settings">
        <Card title="No active space">
          <p>Create or join a space to configure settings.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="settings">
      <header className="settings__header">
        <div>
          <h1>Settings</h1>
          <p className="settings__subtitle">Configure space details, point mode, and invitation codes.</p>
        </div>
        <Button variant="secondary" onClick={refreshSpace}>
          Refresh
        </Button>
      </header>

      <div className="settings__grid">
        <Card title="Space details" padding="lg">
          <dl className="settings__details">
            <div>
              <dt>Name</dt>
              <dd>{activeSpace.name}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{activeSpace.description ?? "—"}</dd>
            </div>
            <div>
              <dt>Point mode</dt>
              <dd>{activeSpace.mode === "price" ? "Price-indexed" : "Sentiment-valued"}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(activeSpace.createdAt)}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Codes" padding="lg">
          <div className="settings__codes">
            <div>
              <span className="settings__code-label">Invite code</span>
              <code className="settings__code" aria-label="Invite code">
                {activeSpace.inviteCode}
              </code>
            </div>
            <div>
              <span className="settings__code-label">Join code</span>
              <code className="settings__code" aria-label="Join code">
                {activeSpace.joinCode}
              </code>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
