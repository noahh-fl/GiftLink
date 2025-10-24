import { useMemo, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import SpaceHeader from "../components/SpaceHeader";
import GiftListCard from "../components/GiftListCard";

interface SpaceMember {
  id: string;
  name: string;
  initials: string;
}

interface SpaceSummary {
  id: string;
  name: string;
  inviteCode: string;
  gifts: string[];
  members: SpaceMember[];
}

const mockSpaces: Record<string, SpaceSummary> = {
  aurora: {
    id: "aurora",
    name: "Aurora Family Space",
    inviteCode: "AUR-2024",
    gifts: [],
    members: [
      { id: "1", name: "Avery Lin", initials: "AL" },
      { id: "2", name: "Noah Diaz", initials: "ND" },
      { id: "3", name: "Riley Chen", initials: "RC" },
      { id: "4", name: "Maya Patel", initials: "MP" },
    ],
  },
};

const cardShell: CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-5)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-4)",
};

const secondaryButton: CSSProperties = {
  background: "var(--color-accent-quiet)",
  color: "var(--color-accent)",
  border: "none",
  borderRadius: "var(--radius-md)",
  padding: "0 var(--space-5)",
  minHeight: "var(--space-12)",
  fontSize: "var(--body-size)",
  fontWeight: "var(--h3-weight)",
  cursor: "pointer",
  transition: "background var(--dur-med) var(--ease)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

export default function SpaceDashboard() {
  const { id } = useParams<{ id: string }>();

  const space = useMemo(() => {
    if (id && mockSpaces[id]) {
      return mockSpaces[id];
    }

    return { ...mockSpaces.aurora, id: id ?? mockSpaces.aurora.id };
  }, [id]);

  const handleAddGift = () => {
    console.info("Add gift action (stub)", space.id);
  };

  const handleInvite = () => {
    console.info("Invite action (stub)", space.inviteCode);
  };

  const handleManageMembers = () => {
    console.info("Manage members action (stub)", space.id);
  };

  return (
    <main
      style={{
        background: "var(--color-bg)",
        minHeight: "100vh",
        padding: "var(--space-6)",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-6)",
        }}
      >
        <SpaceHeader name={space.name} inviteCode={space.inviteCode} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(calc(var(--space-12) * 7), 1fr))",
            gap: "var(--space-5)",
          }}
        >
          <GiftListCard
            giftCount={space.gifts.length}
            spaceId={space.id}
            spaceName={space.name}
            onAddGift={handleAddGift}
          />

          <section style={cardShell} aria-label="Members">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>Members</h2>
                <p
                  style={{
                    margin: 0,
                    marginTop: "var(--space-1)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {space.members.length} joined
                </p>
              </div>
              <button
                type="button"
                className="focus-ring"
                onClick={handleManageMembers}
                style={secondaryButton}
                aria-label="Manage members"
              >
                Manage members
              </button>
            </div>

            <div
              style={{
                display: "flex",
                gap: "var(--space-3)",
                flexWrap: "wrap",
              }}
            >
              {space.members.slice(0, 4).map((member) => (
                <div
                  key={member.id}
                  title={member.name}
                  aria-label={member.name}
                  style={{
                    width: "var(--space-12)",
                    height: "var(--space-12)",
                    borderRadius: "var(--radius-lg)",
                    background: "var(--color-accent-quiet)",
                    color: "var(--color-accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "var(--h3-weight)",
                  }}
                >
                  {member.initials}
                </div>
              ))}
            </div>
          </section>

          <section style={cardShell} aria-label="Quick actions">
            <h2 style={{ margin: 0 }}>Quick actions</h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              <button
                type="button"
                className="focus-ring"
                onClick={handleAddGift}
                style={{
                  ...secondaryButton,
                  background: "var(--color-accent)",
                  color: "var(--color-surface)",
                }}
                aria-label="Add a new gift"
              >
                Add gift
              </button>
              <button
                type="button"
                className="focus-ring"
                onClick={handleInvite}
                style={secondaryButton}
                aria-label="Invite someone"
              >
                Invite
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
