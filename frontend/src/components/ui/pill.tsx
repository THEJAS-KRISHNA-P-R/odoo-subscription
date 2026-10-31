"use client";

import { ReactNode } from "react";

export interface PillProps {
  variant?: "primary" | "soft" | "outline";
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export const Pill = ({
  variant = "primary",
  disabled = false,
  className,
  children,
}: PillProps) => {
  const baseClasses = "inline-flex items-center gap-8px rounded-full font-medium transition-all";

  const variantClasses: Record<string, string> = {
    primary: "bg-[var(--brand-primary)] text-[var(--brand-primary-fg)]",
    soft: "bg-[var(--brand-tint)] text-[var(--brand-text)] border border-2 border-[rgba(22,51,0,0.14)]",
    outline: "bg-white text-[var(--text-primary)] border border-[var(--border-hair)]",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      disabled={disabled}
    >
      {children}
    </button>
  );
};