import { getUserIdentity } from "./user";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const identity = getUserIdentity();

  const headers = new Headers(opts.headers ?? {});
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  headers.set("x-user-id", identity.id);
  headers.set("x-user-name", identity.label);

  return fetch(`${BASE}${path}`, { ...opts, headers });
}
