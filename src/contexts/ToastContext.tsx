import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import "../ui/styles/components/toast.css";

export type ToastIntent = "info" | "success" | "error";

export interface ToastMessage {
  id: number;
  title?: string;
  description: string;
  intent: ToastIntent;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastMessage, "id">) => void;
  dismissToast: (id: number) => void;
  toasts: ToastMessage[];
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    toastIdCounter += 1;
    const next: ToastMessage = { ...toast, id: toastIdCounter };
    setToasts((previous) => [...previous, next]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(
    () => ({ showToast, dismissToast, toasts }),
    [showToast, dismissToast, toasts],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.intent}`}
            role={toast.intent === "error" ? "alert" : "status"}
          >
            {toast.title ? <p className="toast__title">{toast.title}</p> : null}
            <p className="toast__description">{toast.description}</p>
            <button type="button" className="toast__dismiss" onClick={() => dismissToast(toast.id)}>
              <span className="sr-only">Dismiss notification</span>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
