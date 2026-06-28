'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: ToastKind; message: string };
type ToastContextValue = {
  notify: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const recentToasts = useRef<Map<string, number>>(new Map());

  const notify = useCallback((message: string, kind: ToastKind = 'info') => {
    const dedupeKey = `${kind}:${message}`;
    const now = Date.now();
    const lastShownAt = recentToasts.current.get(dedupeKey);
    if (lastShownAt && now - lastShownAt < 1200) return;
    recentToasts.current.set(dedupeKey, now);

    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, kind, message }].slice(-4));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      recentToasts.current.delete(dedupeKey);
    }, 4200);
  }, []);

  const value = useMemo(() => ({
    notify,
    success: (message: string) => notify(message, 'success'),
    error: (message: string) => notify(message, 'error'),
    info: (message: string) => notify(message, 'info'),
  }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <button className={`toast toast-${toast.kind}`} key={toast.id} type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>
            {toast.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}
