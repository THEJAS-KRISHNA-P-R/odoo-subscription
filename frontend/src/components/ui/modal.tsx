"use client";

import { ReactNode } from "react";

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
  if (!open) return null;

  const widthClass = {
    standard: "max-w-sm",
    forms: "max-w-full",
    data: "max-w-2xl",
  }[width];

  return (
    <div className="modal-backdrop" onClick={onClose} aria-label="Modal">
      <div
        className={`modal-shell ${widthClass} rounded-24 transition-smooth`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <h2
            id="modal-title"
            className="text-[var(--text-primary)] text-2xl font-bold"
          >
            {title}
          </h2>
          <button
            className="pill-btn pill-btn--outline"
            onClick={onClose}
            type="button"
            aria-label="Close modal"
          >
            Close
          </button>
        </div>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
};
