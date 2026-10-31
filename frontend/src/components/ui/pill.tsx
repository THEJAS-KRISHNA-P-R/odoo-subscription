"use client";

import { ReactNode } from "react";

export interface PillProps {
  variant?: "primary" | "soft" | "outline";
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export const Pill = ({
  variant = "primary",
  type = "submit",
  disabled = false,
  className,
  children,
}: PillProps) => {
  const baseClasses =
    "inline-flex items-center gap-2 rounded-full font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses: Record<string, string> = {
    primary: "bg-[var(--brand-primary)] text-[var(--brand-primary-fg)]",
    soft: "bg-[var(--brand-tint)] text-[var(--brand-text)] border border-[var(--border-hair)]",
    outline:
      "bg-white text-[var(--text-primary)] border border-[var(--border-hair)]",
  };

  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${className ?? ""}`}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
