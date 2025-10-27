import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface SpaceMetadata {
  id: string;
  name?: string;
}

interface SpaceContextValue {
  activeSpaceId: string | null;
  activeSpaceName: string;
  setActiveSpace: (metadata: SpaceMetadata) => void;
  clearActiveSpace: () => void;
}

const defaultValue: SpaceContextValue = {
  activeSpaceId: null,
  activeSpaceName: "",
  setActiveSpace: () => {
    throw new Error("setActiveSpace called outside of SpaceProvider");
  },
  clearActiveSpace: () => {
    throw new Error("clearActiveSpace called outside of SpaceProvider");
  },
};

const SpaceContext = createContext<SpaceContextValue>(defaultValue);

const STORAGE_KEY = "giftlink.activeSpace";

function readStoredSpace(): SpaceMetadata | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "id" in parsed &&
      typeof (parsed as { id: unknown }).id === "string"
    ) {
      const id = (parsed as { id: string }).id;
      const name =
        "name" in (parsed as Record<string, unknown>) &&
        typeof (parsed as { name?: unknown }).name === "string"
          ? ((parsed as { name?: string }).name as string)
          : "";
      return { id, name };
    }
  } catch (error) {
    console.warn("Unable to read stored space", error);
  }

  return null;
}

function persistSpace(metadata: SpaceMetadata | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!metadata) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.warn("Unable to persist space", error);
  }
}

export function SpaceProvider({ children }: { children: ReactNode }) {
  const stored = useMemo(() => readStoredSpace(), []);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(stored?.id ?? null);
  const [activeSpaceName, setActiveSpaceName] = useState<string>(stored?.name ?? "");

  useEffect(() => {
    persistSpace(
      activeSpaceId
        ? {
            id: activeSpaceId,
            name: activeSpaceName,
          }
        : null,
    );
  }, [activeSpaceId, activeSpaceName]);

  const setActiveSpace = useCallback((metadata: SpaceMetadata) => {
    setActiveSpaceId(metadata.id);
    setActiveSpaceName(metadata.name ?? "");
  }, []);

  const clearActiveSpace = useCallback(() => {
    setActiveSpaceId(null);
    setActiveSpaceName("");
  }, []);

  const value = useMemo(
    () => ({ activeSpaceId, activeSpaceName, setActiveSpace, clearActiveSpace }),
    [activeSpaceId, activeSpaceName, setActiveSpace, clearActiveSpace],
  );

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}

export function useSpace() {
  return useContext(SpaceContext);
}

export default SpaceContext;
