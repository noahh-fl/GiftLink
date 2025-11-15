import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { SpaceProvider } from "./contexts/SpaceContext";
import { ToastProvider } from "./contexts/ToastContext";

import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import StartFlow from "./pages/StartFlow";
import CreateSpace from "./pages/CreateSpace";
import JoinSpace from "./pages/JoinSpace";
import SpaceLayout from "./pages/SpaceLayout";
import SpaceDashboard from "./pages/SpaceDashboard";
import SpaceWishlist from "./pages/SpaceWishlist";
import SpacePointShop from "./pages/SpacePointShop";
import SpaceInbox from "./pages/SpaceInbox";
import ProtectedRoute from "./components/ProtectedRoute";

import "./ui/tokens/tokens.css";
import "./ui/styles/base.css";

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Protected routes - require authentication */}
      <Route path="/start" element={<ProtectedRoute><StartFlow /></ProtectedRoute>} />
      <Route path="/start/create" element={<ProtectedRoute><CreateSpace /></ProtectedRoute>} />
      <Route path="/start/join" element={<ProtectedRoute><JoinSpace /></ProtectedRoute>} />
      <Route path="/spaces/:spaceId" element={<ProtectedRoute><SpaceLayout /></ProtectedRoute>}>
        <Route index element={<SpaceDashboard />} />
        <Route path="wishlist" element={<SpaceWishlist />} />
        <Route path="shop" element={<SpacePointShop />} />
        <Route path="inbox" element={<SpaceInbox />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <SpaceProvider>
        <ToastProvider>
          <Router>
            <AppRoutes />
          </Router>
        </ToastProvider>
      </SpaceProvider>
    </AuthProvider>
  );
}

export default App;
