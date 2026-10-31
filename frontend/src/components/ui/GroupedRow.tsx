'use client';

import React from 'react';

export interface GroupedRowProps {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function GroupedRow({ onClick, children, className = '', ariaLabel }: GroupedRowProps) {
  const baseClass = `w-full bg-[var(--bg-surface)] px-[20px] py-[16px] transition-colors duration-150 first:rounded-t-[16px] last:rounded-b-[16px] not-last:border-b not-last:border-[var(--border-faint)] ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={`${baseClass} text-left cursor-pointer hover:bg-[var(--bg-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9FE870] block`}
      >
        {children}
      </button>
    );
  }

  return <div className={baseClass}>{children}</div>;
}

export function GroupedRowContainer({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`rounded-[16px] overflow-hidden ${className}`}>{children}</div>;
}
