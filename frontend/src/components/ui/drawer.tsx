"use client";

import { ReactNode } from "react";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export const Drawer = ({
  open,
  onClose,
  children,
  title,
}: DrawerProps) => {
  if (!open) return null;

  return (
    <div className="drawer-scrim" onClick={onClose} aria-label="Overlay click to close">
      <div
        className="drawer-shell"
        role="dialog"
        aria-modal="true"
        aria-label={title || "Drawer"}
      >
        {title && (
          <div className="mb-6 pb-6 border-b border-[var(--border-faint)]">
            <h3 className="heading-section text-[var(--text-primary)] mb-2">{title}</h3>
          </div>
        )}
        <div className="flex-1">
          {children}
        </div>
        <div className="mt-6 pt-6 border-t border-[var(--border-faint)] flex justify-end">
          <button
            className="pill-btn pill-btn--outline"
            onClick={onClose}
            aria-label="Close drawer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};