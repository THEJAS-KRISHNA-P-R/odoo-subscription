'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

export interface ToastItem {
  keyId: string;
  tone: 'success' | 'error' | 'info';
  text: string;
}

interface ToastContextValue {
  showToast: (text: string, tone?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

function ToastMessage({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (keyId: string) => void;
}) {
  useEffect(() => {
    const expireCallback = () => {
      onDismiss(item.keyId);
    };
    const timerId = window.setTimeout(expireCallback, 4000);
    return () => window.clearTimeout(timerId);
  }, [item.keyId, onDismiss]);

  const toneClasses =
    item.tone === 'error'
      ? 'bg-[#141A16] text-white border border-[var(--danger-border)]'
      : item.tone === 'success'
      ? 'bg-[#163300] text-white border border-[#284D0B]'
      : 'bg-[#141A16] text-white border border-[var(--border-hair)]';

  return (
    <div
      className={`rounded-full px-5 py-3 shadow-[var(--shadow-floating)] flex items-center gap-3 text-[13px] font-semibold animate-scale-in ${toneClasses}`}
    >
      {item.tone === 'error' ? (
        <AlertTriangle className="w-4 h-4 text-[#FCA5A5] shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-[var(--brand-primary)] shrink-0" aria-hidden="true" />
      )}
      <span>{item.text}</span>
      <button
        type="button"
        onClick={() => onDismiss(item.keyId)}
        aria-label="Dismiss notification"
        className="ml-1 opacity-75 hover:opacity-100 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((keyId: string) => {
    setToasts((prev) => prev.filter((t) => t.keyId !== keyId));
  }, []);

  const showToast = useCallback((text: string, tone: 'success' | 'error' | 'info' = 'info') => {
    const keyId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { keyId, tone, text }]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-6 right-6 z-[100000] flex flex-col items-end gap-2.5 no-print"
      >
        {toasts.map((item) => (
          <ToastMessage key={item.keyId} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
