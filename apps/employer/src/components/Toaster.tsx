"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Toast = { id: number; message: string };

const ToastContext = createContext<(message: string) => void>(() => undefined);

const TOAST_MILLISECONDS = 4000;
/** "+20 肉球ポイント" / "+20 Paw Points" is highlighted like a reward pop-up. */
const POINTS_PATTERN = /(\+\d+ (?:肉球ポイント|Paw Points))/;

/** Shows action results after the page refreshes, like the reward pop-ups in the worker app. */
export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-2), { id, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_MILLISECONDS);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="toastRegion" role="status">
        {toasts.map((toast) => (
          <p className="toast" key={toast.id}>
            {toast.message.split(POINTS_PATTERN).map((part, index) =>
              POINTS_PATTERN.test(part) ? <strong key={index}>{part}</strong> : part,
            )}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}
