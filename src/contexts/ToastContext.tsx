import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { generateId } from "../utils/id";

interface Toast {
  id: string;
  title: string;
  tone: "default" | "error" | "success";
}

interface ToastContextValue {
  notify: (title: string, tone?: Toast["tone"]) => void;
  clear: (id: string) => void;
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const clear = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((title: string, tone: Toast["tone"] = "default") => {
    const id = generateId("toast");
    setToasts((prev) => [...prev, { id, title, tone }]);
    window.setTimeout(() => {
      clear(id);
    }, 4000);
  }, [clear]);

  const value = useMemo(
    () => ({
      notify,
      clear,
      toasts,
    }),
    [notify, clear, toasts],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
