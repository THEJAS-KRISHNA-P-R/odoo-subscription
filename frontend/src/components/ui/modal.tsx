"use client";

import { ReactNode, useState } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title: string;
  width?: "standard" | "forms" | "data";
}

export const Modal = ({
  open,
  onClose,
  children,
  title,
  width = "standard",
}: ModalProps) => {
  const [mounted] = useState(false);

  // Width classes based on modal type
  const widthClass = {
    standard: "max-w-sm",
    forms: "max-w-full",
    data: "max-w-2xl",
  }[width];

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} aria-label="Modal">
      <div
        className={`modal-shell ${widthClass} rounded-24 transition-smooth`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title className="text-[var(--text-primary)] text-2xl font-bold mb-6">
          {title}
        </h2>
        <div className="flex-1">{children}</div>
        <div className="mt-6 pt-6 border-t border-[var(--border-faint)] flex justify-end gap-3">
          <button
            className="pill-btn pill-btn--outline flex items-center gap-2"
            onClick={onClose}
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button
            className="pill-btn pill-btn--primary flex items-center gap-2"
            type="button"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};