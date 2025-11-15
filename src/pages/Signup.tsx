import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Button from "../ui/components/Button";
import Input from "../ui/components/Input";
import FormField from "../ui/components/FormField";
import "./Auth.css";

export default function Signup() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    // Basic validation
    const newErrors: { name?: string; email?: string; password?: string } = {};
    if (!name) newErrors.name = "Name is required";
    if (!email) newErrors.email = "Email is required";
    if (!password) newErrors.password = "Password is required";
    else if (password.length < 8) newErrors.password = "Password must be at least 8 characters";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("http://localhost:3000/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ general: data.error || "Registration failed" });
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
            Create your account
          </h1>
          <p className="auth__subtitle">
            Start sharing wishlists and earning points together
          </p>
        </div>

        <form className="auth__form" onSubmit={handleSubmit}>
          {errors.general && (
            <div className="auth__error" role="alert">
              {errors.general}
            </div>
          )}

          <FormField
            label="Name"
            htmlFor="name"
            required
            error={errors.name}
          >
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              hasError={!!errors.name}
              autoComplete="name"
              autoFocus
            />
          </FormField>

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
            />
          </FormField>

          <FormField
            label="Password"
            htmlFor="password"
            required
            error={errors.password}
            hint="Must be at least 8 characters"
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              hasError={!!errors.password}
              autoComplete="new-password"
            />
          </FormField>

          <div className="auth__actions">
            <Button type="submit" isLoading={isLoading} disabled={isLoading}>
              {isLoading ? "Creating account..." : "Sign up"}
            </Button>
          </div>
        </form>

        <p className="auth__footer">
          Already have an account?{" "}
          <Link to="/login" className="auth__link">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
