import { Link, Route, Routes } from "react-router-dom";
import AppShell from "./ui/components/AppShell";
import Button from "./ui/components/Button";
import { useSpace } from "./contexts/SpaceContext";
import DashboardPage from "./pages/dashboard/DashboardPage";
import WishlistPage from "./pages/wishlist/WishlistPage";
import BrowsePage from "./pages/browse/BrowsePage";
import GiftDetailPage from "./pages/gift/GiftDetailPage";
import PointShopPage from "./pages/shop/PointShopPage";
import LedgerPage from "./pages/ledger/LedgerPage";
import SettingsPage from "./pages/settings/SettingsPage";

const NAV_LINKS = [
  { to: "/", label: "Dashboard" },
  { to: "/wishlist", label: "Wishlist" },
  { to: "/browse", label: "Browse" },
  { to: "/shop", label: "Point shop" },
  { to: "/ledger", label: "Ledger" },
  { to: "/settings", label: "Settings" },
];

function App() {
  const { activeSpace } = useSpace();

  const headerActions = (
    <>
      <span aria-live="polite" className="app-header__balance">
        {activeSpace?.points ?? 0} pts
      </span>
      <Button asChild variant="secondary">
        <Link to="/wishlist">Add gift</Link>
      </Button>
    </>
  );

  return (
    <AppShell navLinks={NAV_LINKS} headerActions={headerActions}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/gift/:id" element={<GiftDetailPage />} />
        <Route path="/shop" element={<PointShopPage />} />
        <Route path="/ledger" element={<LedgerPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppShell>
  );
}

export default App;
