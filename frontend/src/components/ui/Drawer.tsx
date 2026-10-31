'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  printable?: boolean;
  children: React.ReactNode;
}

export function Drawer({ open, onClose, title, badge, footer, printable = false, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className={`fixed inset-0 z-[99998] flex justify-end ${printable ? 'print-drawer' : 'no-print'}`} role="dialog" aria-modal="true">
      <div
        className="fixed inset-0 bg-[var(--bg-scrim)] backdrop-blur-[4px] animate-fade-in no-print"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="drawer-panel relative z-[99999] w-full sm:w-[560px] max-w-full h-full bg-[var(--bg-card)] shadow-[var(--shadow-drawer)] flex flex-col overflow-hidden animate-slide-in-right">
        <div className="px-[32px] py-[24px] border-b border-[var(--border-faint)] flex items-center justify-between gap-4 shrink-0 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)] truncate">
              {title}
            </h2>
            {badge}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="w-9 h-9 rounded-full inline-flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9FE870]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="drawer-content flex-1 overflow-y-auto divide-y divide-[var(--border-faint)]">
          {children}
        </div>

        {footer && (
          <div className="px-[32px] py-[20px] border-t border-[var(--border-faint)] bg-[var(--bg-card)] flex flex-wrap items-center justify-end gap-2.5 shrink-0 no-print">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function DrawerSection({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-[32px] py-[24px] bg-[var(--bg-card)] ${className}`}>
      {title && (
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)] mb-3">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
