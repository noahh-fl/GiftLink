import { useEffect, useState } from "react";
import axios from "axios";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import HomeChoice from "./pages/HomeChoice";
import SpaceNew from "./pages/SpaceNew";
import GiftList from "./pages/GiftList";
import SpaceDashboard from "./pages/SpaceDashboard";
import SpaceWishlist from "./pages/SpaceWishlist";
import SpacePointShop from "./pages/SpacePointShop";
import SpaceLedger from "./pages/SpaceLedger";
import SpaceGiftDetail from "./pages/SpaceGiftDetail";
import AppShell from "./ui/components/AppShell";
import "./ui/tokens/tokens.css";
import "./ui/styles/base.css";

interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch users on load
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:3000/users");
      setUsers(res.data);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return alert("Please fill out both fields.");

    setLoading(true);
    try {
      await axios.post("http://127.0.0.1:3000/user", { name, email });
      setName("");
      setEmail("");
      fetchUsers(); // refresh list
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message;
      if (typeof message === "string" && message.includes("Unique constraint")) {
        alert("That email is already registered.");
      } else {
        alert("Error adding user. Check the console.");
      }
    } finally {
      setLoading(false);
    }
  };

  const headerActions = (
    <Link to="/users" className="app-header__action">
      Manage users
    </Link>
  );

  return (
    <Router>
      <AppShell headerActions={headerActions}>
        <Routes>
          <Route path="/" element={<HomeChoice />} />
          <Route path="/space/new" element={<SpaceNew />} />
          <Route path="/spaces/:spaceId" element={<SpaceDashboard />} />
          <Route path="/spaces/:spaceId/wishlist" element={<SpaceWishlist />} />
          <Route path="/spaces/:spaceId/point-shop" element={<SpacePointShop />} />
          <Route path="/spaces/:spaceId/ledger" element={<SpaceLedger />} />
          <Route path="/spaces/:spaceId/gifts" element={<GiftList />} />
          <Route path="/spaces/:spaceId/gifts/:giftId" element={<SpaceGiftDetail />} />
          <Route path="/space/:id/gifts" element={<GiftList />} />
          <Route
            path="/users"
            element={
              <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
                <h1>GiftLink Users</h1>

                <form onSubmit={handleAddUser} style={{ marginBottom: "1.5rem" }}>
                  <input
                    type="text"
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ marginRight: "0.5rem", padding: "0.5rem" }}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ marginRight: "0.5rem", padding: "0.5rem" }}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    style={{ padding: "0.5rem 1rem" }}
                  >
                    {loading ? "Adding..." : "Add User"}
                  </button>
                </form>

                {users.length === 0 ? (
                  <p>No users yet.</p>
                ) : (
                  <ul>
                    {users.map((u) => (
                      <li key={u.id}>
                        <strong>{u.name}</strong> — {u.email}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            }
          />
        </Routes>
      </AppShell>
    </Router>
  );
}

export default App;
