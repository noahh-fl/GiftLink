import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Button from "../ui/components/Button";
import Input from "../ui/components/Input";
import FormField from "../ui/components/FormField";
import "./Auth.css";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    // Basic validation
    const newErrors: { email?: string; password?: string } = {};
    if (!email) newErrors.email = "Email is required";
    if (!password) newErrors.password = "Password is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("http://localhost:3000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ general: data.error || "Login failed" });
        setIsLoading(false);
        return;
      }

      // Use AuthContext to store tokens and user
      login(data.accessToken, data.refreshToken, data.user);

      // Fetch user's spaces to determine redirect
      try {
        const spacesResponse = await fetch("http://localhost:3000/user/spaces", {
          headers: {
            "Authorization": `Bearer ${data.accessToken}`,
            "Content-Type": "application/json",
          },
        });

        if (spacesResponse.ok) {
          const spacesData = await spacesResponse.json();

          // If user has spaces, redirect to the most recent one
          if (spacesData.spaces && spacesData.spaces.length > 0) {
            navigate(`/spaces/${spacesData.spaces[0].id}`);
            return;
          }
        }
      } catch (spacesError) {
        console.error("Failed to fetch user spaces:", spacesError);
        // Continue to /start if spaces fetch fails
      }

      // If no spaces or fetch failed, redirect to start flow
      navigate("/start");
    } catch (error) {
      setErrors({ general: "An error occurred. Please try again." });
      setIsLoading(false);
    }
  };

  return (
    <main className="auth" aria-labelledby="auth-title">
      <div className="auth__container">
        <div className="auth__header">
          <p className="auth__eyebrow">GiftLink</p>
          <h1 id="auth-title" className="auth__title">
            Welcome back
          </h1>
          <p className="auth__subtitle">
            Sign in to continue to your spaces
          </p>
        </div>

        <form className="auth__form" onSubmit={handleSubmit}>
          {errors.general && (
            <div className="auth__error" role="alert">
              {errors.general}
            </div>
          )}

          <FormField
            label="Email"
            htmlFor="email"
            required
            error={errors.email}
          >
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              hasError={!!errors.email}
              autoComplete="email"
              autoFocus
            />
          </FormField>

          <FormField
            label="Password"
            htmlFor="password"
            required
            error={errors.password}
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              hasError={!!errors.password}
              autoComplete="current-password"
            />
          </FormField>

          <div className="auth__actions">
            <Button type="submit" isLoading={isLoading} disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </div>
        </form>

        <p className="auth__footer">
          Don't have an account?{" "}
          <Link to="/signup" className="auth__link">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
