const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

/**
 * API fetch wrapper that automatically includes JWT authentication token
 * @param path - API endpoint path (e.g., "/spaces")
 * @param opts - Fetch options (method, body, etc.)
 * @returns Promise<Response>
 */
export async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const headers = new Headers(opts.headers ?? {});

  // Set content-type header if not already set
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  // Add JWT token from localStorage if available
  const accessToken = localStorage.getItem("accessToken");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return fetch(`${BASE}${path}`, { ...opts, headers });
}

/**
 * API fetch with automatic token refresh on 401 errors
 * If access token is expired, tries to refresh it once and retry the request
 */
export async function apiFetchWithRefresh(path: string, opts: RequestInit = {}): Promise<Response> {
  let response = await apiFetch(path, opts);

  // If we get a 401, try to refresh the token and retry once
  if (response.status === 401) {
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          localStorage.setItem("accessToken", data.accessToken);

          // Retry the original request with new token
          response = await apiFetch(path, opts);
        } else {
          // Refresh failed, clear tokens and redirect to login
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");
          window.location.href = "/login";
        }
      } catch (error) {
        console.error("Token refresh failed:", error);
        window.location.href = "/login";
      }
    } else {
      // No refresh token, redirect to login
      window.location.href = "/login";
    }
  }

  return response;
}
