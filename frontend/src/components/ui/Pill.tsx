'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface PillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'soft' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  loading?: boolean;
  children: React.ReactNode;
}

export function Pill({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: PillProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full whitespace-nowrap shrink-0 cursor-pointer select-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9FE870] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

  const variantClasses: Record<NonNullable<PillProps['variant']>, string> = {
    primary:
      'bg-[var(--brand-primary)] text-[var(--brand-primary-fg)] font-bold hover:bg-[var(--brand-primary-hover)] hover:-translate-y-[1px] active:translate-y-0',
    soft:
      'bg-[var(--brand-tint)] text-[var(--brand-dark)] border border-[rgba(22,51,0,0.14)] font-semibold hover:bg-[var(--brand-tint-hover)]',
    outline:
      'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-hair)] font-semibold hover:bg-[var(--bg-muted)] hover:border-[var(--text-muted)]',
    danger:
      'bg-[var(--danger-bg)] text-[var(--danger-fg)] border border-[var(--danger-border)] font-semibold hover:bg-[#FEE2E2]',
    ghost:
      'bg-transparent text-[var(--text-secondary)] font-semibold hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]',
  };

  const sizeClasses =
    size === 'sm'
      ? 'px-4 py-1.5 text-[13px]'
      : variant === 'outline' || variant === 'danger'
      ? 'px-[18px] py-[8px] text-[13px]'
      : variant === 'soft'
      ? 'px-[20px] py-[9px] text-[14px]'
      : 'px-[22px] py-[10px] text-[14px]';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${base} ${variantClasses[variant]} ${sizeClasses} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}
