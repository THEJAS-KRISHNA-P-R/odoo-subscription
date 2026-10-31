'use client';

import React from 'react';

export interface BentoMetricProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function BentoMetric({ label, value, hint, action, className = '' }: BentoMetricProps) {
  return (
    <div
      className={`bg-[var(--bg-surface)] rounded-[24px] px-[32px] py-[28px] flex flex-col justify-between gap-3 ${className}`}
    >
      <span className="text-[13px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
        {label}
      </span>
      <div className="text-[32px] font-bold tracking-[-0.02em] leading-[1.15] text-[var(--text-primary)] tabular-nums">
        {value}
      </div>
      {(hint || action) && (
        <div className="flex items-center justify-between gap-2 pt-1 text-[13px] text-[var(--text-secondary)]">
          {hint && <span>{hint}</span>}
          {action}
        </div>
      )}
    </div>
  );
}
