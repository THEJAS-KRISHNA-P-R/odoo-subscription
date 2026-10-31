"use client";

import { ReactNode } from "react";

export interface GroupedRowProps {
  label: string;
  value: string | number;
  className?: string;
  href?: string;
}

export const GroupedRow = ({
  label,
  value,
  className,
  href,
}: GroupedRowProps) => {
  const classes = "flex items-center justify-between py-3 px-0 border-b border-[var(--border-faint)] last:border-0";

  return (
    <div className={classes}>
      <span className="body-medium text-[var(--text-secondary)]">{label}</span>
      <span className="body-normal font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
};