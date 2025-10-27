const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function apiFetch(
  path: string,
  opts: RequestInit = {},
): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  } as Record<string, string>;

  return fetch(`${BASE}${path}`, { ...opts, headers });
}
