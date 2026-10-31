'use client';

import React from 'react';

export interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

const STATUS_STYLE_MAP: Record<string, string> = {
  draft: 'bg-[var(--bg-surface-hover)] text-[var(--text-primary)]',
  quotation: 'bg-[var(--hero-blue)] text-[var(--hero-blue-fg)]',
  confirmed: 'bg-[var(--hero-purple)] text-[var(--hero-purple-fg)]',
  active: 'bg-[var(--brand-tint)] text-[var(--brand-dark)]',
  paused: 'bg-[var(--warning-bg)] text-[var(--warning-fg)]',
  closed: 'bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]',
  paid: 'bg-[var(--brand-primary)] text-[var(--brand-primary-fg)]',
  cancelled: 'bg-[var(--bg-surface)] text-[var(--text-muted)] line-through',
  overdue: 'bg-[var(--danger-bg)] text-[var(--danger-fg)] border border-[var(--danger-border)]',
  inactive: 'bg-[var(--bg-surface)] text-[var(--text-muted)]',
};

export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const normalized = (status || '').toLowerCase();
  const colorClasses = STATUS_STYLE_MAP[normalized] || 'bg-[var(--bg-surface)] text-[var(--text-secondary)]';
  const displayText =
    label ||
    (status
      ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
      : 'Unknown');

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold tracking-[0.02em] leading-[1.3] whitespace-nowrap shrink-0 ${colorClasses} ${className}`}
    >
      {displayText}
    </span>
  );
}
