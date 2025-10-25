import { useEffect, useState } from "react";
import axios from "axios";
import SpaceNew from "./pages/SpaceNew";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomeChoice from "./pages/HomeChoice";
import GiftList from "./pages/GiftList";
import SpaceJoin from "./pages/SpaceJoin";
import SpaceDashboard from "./pages/SpaceDashboard";
import GiftDetail from "./pages/GiftDetail";

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

  return (
    <Router>
      <Routes>
        {/* Temporary HomeChoice route for Issue #3 */}
        <Route path="/" element={<HomeChoice />} />
        <Route path="/space/new" element={<SpaceNew />} />
        <Route path="/space/join" element={<SpaceJoin />} />
        <Route path="/space/:id" element={<SpaceDashboard />} />
        <Route path="/space/:id/gifts" element={<GiftList />} />
        <Route path="/space/:id/gifts/:giftId" element={<GiftDetail />} />


        {/* Existing test route just to keep user management functional */}
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
    </Router>
  );
}

export default App;
