const STORAGE_KEY = "giftlink.user.identity";

type UserIdentity = {
  id: string;
  label: string;
};

let cachedIdentity: UserIdentity | null = null;

function createIdentity(): UserIdentity {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return {
    id: `tester-${suffix}`,
    label: "You",
  };
}

export function getUserIdentity(): UserIdentity {
  if (cachedIdentity) {
    return cachedIdentity;
  }

  if (typeof window === "undefined") {
    cachedIdentity = { id: "server", label: "Server" };
    return cachedIdentity;
  }

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) {
      const parsed = JSON.parse(existing) as Partial<UserIdentity>;
      if (parsed && typeof parsed.id === "string" && parsed.id.trim()) {
        const identity: UserIdentity = {
          id: parsed.id.trim(),
          label:
            typeof parsed.label === "string" && parsed.label.trim() ? parsed.label.trim() : "You",
        };
        cachedIdentity = identity;
        return identity;
      }
    }
  } catch (error) {
    console.warn("Unable to read stored identity", error);
  }

  const identity = createIdentity();

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch (error) {
    console.warn("Unable to persist identity", error);
  }

  cachedIdentity = identity;
  return identity;
}

export function resetIdentityForTesting() {
  cachedIdentity = null;
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Unable to clear stored identity", error);
  }
}
