import {
  BrowserRouter as Router,
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { SpaceProvider, useSpace } from "./contexts/SpaceContext";
import { ToastProvider } from "./contexts/ToastContext";

import AppShell from "./ui/components/AppShell";
import SpaceJoin from "./pages/SpaceJoin";
import Button from "./ui/components/Button";

import "./ui/tokens/tokens.css";
import "./ui/styles/base.css";
import "./ui/styles/components/primary-nav.css";
import "./ui/styles/components/page.css";

type NavItem = {
  label: string;
  to: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Wishlist", to: "/wishlist" },
  { label: "Browse", to: "/browse" },
  { label: "Gift", to: "/gift/demo" },
  { label: "Ledger", to: "/ledger" },
  { label: "Shop", to: "/shop" },
  { label: "Settings", to: "/settings" },
];

function PrimaryNav({ items }: { items: NavItem[] }) {
  return (
    <ul className="primary-nav" role="list">
      {items.map((item) => (
        <li key={item.to} className="primary-nav__item">
          <NavLink
            to={item.to}
            className={({ isActive }) =>
              ["primary-nav__link", isActive ? "primary-nav__link--active" : ""]
                .filter(Boolean)
                .join(" ")
            }
          >
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function Page({ title, description }: { title: string; description: string }) {
  const { activeSpaceId, activeSpaceName } = useSpace();
  const pageId = `page-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className="page" aria-labelledby={pageId}>
      <h1 id={pageId} className="page__title">
        {title}
      </h1>
      <p className="page__subtitle">{description}</p>
      <div>
        {activeSpaceId ? (
          <p className="page__empty-state">
            Active space: {activeSpaceName ? `${activeSpaceName} (#${activeSpaceId})` : `#${activeSpaceId}`}
          </p>
        ) : (
          <p className="page__empty-state">Join a space to unlock this view.</p>
        )}
      </div>
    </section>
  );
}

function GiftDetailPage() {
  const { activeSpaceId } = useSpace();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  return (
    <section className="page" aria-labelledby="gift-detail-heading">
      <h1 id="gift-detail-heading" className="page__title">
        Gift detail
      </h1>
      <p className="page__subtitle">
        Inspect details for gift {id ?? ""}. Use the navigation to return to the dashboard.
      </p>
      <div className="page__actions">
        <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
          Go back
        </Button>
        {activeSpaceId ? (
          <Button type="button" onClick={() => navigate("/dashboard")}>Return to dashboard</Button>
        ) : null}
      </div>
    </section>
  );
}

function NotFoundPage() {
  return <Navigate to="/dashboard" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={<Page title="Dashboard" description="Overview of your active space." />}
      />
      <Route
        path="/wishlist"
        element={<Page title="Wishlist" description="Manage saved wishes for your space." />}
      />
      <Route
        path="/browse"
        element={<Page title="Browse" description="Discover ideas to add to your wishlist." />}
      />
      <Route path="/gift/:id" element={<GiftDetailPage />} />
      <Route
        path="/ledger"
        element={<Page title="Ledger" description="Track contributions and fulfillment." />}
      />
      <Route
        path="/shop"
        element={<Page title="Point shop" description="Redeem points for rewards." />}
      />
      <Route
        path="/settings"
        element={<Page title="Settings" description="Configure space preferences and notifications." />}
      />
      <Route path="/join" element={<SpaceJoin />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function App() {
  return (
    <SpaceProvider>
      <ToastProvider>
        <Router>
          <AppShell navigation={<PrimaryNav items={NAV_ITEMS} />}>
            <AppRoutes />
          </AppShell>
        </Router>
      </ToastProvider>
    </SpaceProvider>
  );
}

export default App;
