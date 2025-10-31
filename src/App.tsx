import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import { SpaceProvider } from "./contexts/SpaceContext";
import { ToastProvider } from "./contexts/ToastContext";

import Welcome from "./pages/Welcome";
import StartFlow from "./pages/StartFlow";
import CreateSpace from "./pages/CreateSpace";
import JoinSpace from "./pages/JoinSpace";
import SpaceLayout from "./pages/SpaceLayout";
import SpaceDashboard from "./pages/SpaceDashboard";
import SpaceWishlist from "./pages/SpaceWishlist";
import SpacePointShop from "./pages/SpacePointShop";

import "./ui/tokens/tokens.css";
import "./ui/styles/base.css";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/start" element={<StartFlow />} />
      <Route path="/start/create" element={<CreateSpace />} />
      <Route path="/start/join" element={<JoinSpace />} />
      <Route path="/spaces/:spaceId" element={<SpaceLayout />}>
        <Route index element={<SpaceDashboard />} />
        <Route path="wishlist" element={<SpaceWishlist />} />
        <Route path="shop" element={<SpacePointShop />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <SpaceProvider>
      <ToastProvider>
        <Router>
          <AppRoutes />
        </Router>
      </ToastProvider>
    </SpaceProvider>
  );
}

export default App;
