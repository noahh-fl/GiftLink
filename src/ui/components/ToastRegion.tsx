import { useToast } from "../../contexts/ToastContext";
import "../styles/components/toast.css";

export default function ToastRegion() {
  const { toasts, clear } = useToast();

  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true" role="status">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`}>
          <span>{toast.title}</span>
          <button type="button" className="toast__close" onClick={() => clear(toast.id)} aria-label="Dismiss alert">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
