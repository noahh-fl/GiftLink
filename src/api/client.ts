import type { Gift, Space } from "./types";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

function getBaseUrl() {
  const env = import.meta.env?.VITE_API_BASE_URL;
  if (typeof env === "string" && env.trim().length > 0) {
    return env.trim().replace(/\/$/, "");
  }
  return DEFAULT_BASE_URL;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      }
    } catch (error) {
      // ignore json parse failures
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function listSpaces(): Promise<Space[]> {
  return request<Space[]>("/space");
}

export async function createSpace(payload: { name: string; description?: string | null }): Promise<{ space: Space }> {
  return request<{ space: Space }>("/spaces", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSpace(spaceId: number): Promise<{ space: Space }> {
  return request<{ space: Space }>(`/spaces/${spaceId}`);
}

export async function listGifts(spaceId: number): Promise<Gift[]> {
  return request<Gift[]>(`/space/${spaceId}/gifts`);
}

export async function createGift(spaceId: number, payload: Partial<Gift> & { name: string; url: string }): Promise<Gift> {
  return request<Gift>(`/space/${spaceId}/gift`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function confirmGift(giftId: number): Promise<Gift> {
  return request<Gift>(`/gift/${giftId}/confirm`, {
    method: "PATCH",
  });
}

export async function getSpacePoints(spaceId: number): Promise<{ points: number }> {
  return request<{ points: number }>(`/space/${spaceId}/points`);
}
