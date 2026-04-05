import { createContext, useContext, useMemo, useState } from "react";
import { createId } from "../utils/uuid";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = (toast) => {
    const id = createId();
    const duration = toast.duration ?? 3500;
    setToasts((current) => [...current, { ...toast, id }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
      }, duration);
    }
  };

  const value = useMemo(() => ({ showToast }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type || "info"}`}>
            <div className="toast-title">{toast.title}</div>
            {toast.message ? <div className="toast-message">{toast.message}</div> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
