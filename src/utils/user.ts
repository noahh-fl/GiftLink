export interface UserIdentity {
  id: string;
  label: string;
}

const STORAGE_KEY = "giftlink.activeTester";
const DEFAULT_TESTER = "user-A";
const TEST_USERS = ["user-A", "user-B", "user-C"] as const;
const CHANGE_EVENT = "giftlink:active-tester-changed";

type TesterId = (typeof TEST_USERS)[number];

let cachedId: TesterId | null = null;

function sanitizeTesterId(value: unknown): TesterId {
  if (typeof value === "string") {
    const match = TEST_USERS.find((tester) => tester === value.trim());
    if (match) {
      return match;
    }
  }
  return DEFAULT_TESTER;
}

function buildIdentity(id: TesterId): UserIdentity {
  return { id, label: id };
}

function readStoredTester(): TesterId | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && stored.trim()) {
      return sanitizeTesterId(stored);
    }
  } catch (error) {
    console.warn("Unable to read active tester from storage", error);
  }
  return null;
}

function persistTester(id: TesterId) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch (error) {
    console.warn("Unable to persist active tester", error);
  }
}

export function listTestUsers(): TesterId[] {
  return [...TEST_USERS];
}

export function getCurrentUserId(): TesterId {
  if (cachedId) {
    return cachedId;
  }

  if (typeof window === "undefined") {
    cachedId = DEFAULT_TESTER;
    return cachedId;
  }

  const stored = readStoredTester();
  if (stored) {
    cachedId = stored;
    return cachedId;
  }

  persistTester(DEFAULT_TESTER);
  cachedId = DEFAULT_TESTER;
  return cachedId;
}

export function setCurrentUserId(id: string) {
  const next = sanitizeTesterId(id);
  if (cachedId === next) {
    return;
  }
  cachedId = next;
  persistTester(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { id: next } }));
  }
}

export function getUserIdentity(): UserIdentity {
  const id = getCurrentUserId();
  return buildIdentity(id);
}

export function resetIdentityForTesting() {
  cachedId = DEFAULT_TESTER;
  persistTester(DEFAULT_TESTER);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { id: DEFAULT_TESTER } }));
  }
}

export function subscribeToUserChanges(listener: (identity: UserIdentity) => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleCustom = (event: Event) => {
    const detail = (event as CustomEvent<{ id?: string }>).detail;
    const nextId = detail?.id ? sanitizeTesterId(detail.id) : getCurrentUserId();
    cachedId = nextId;
    listener(buildIdentity(nextId));
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      const next = event.newValue ? sanitizeTesterId(event.newValue) : DEFAULT_TESTER;
      cachedId = next;
      listener(buildIdentity(next));
    }
  };

  window.addEventListener(CHANGE_EVENT, handleCustom as EventListener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(CHANGE_EVENT, handleCustom as EventListener);
    window.removeEventListener("storage", handleStorage);
  };
}
