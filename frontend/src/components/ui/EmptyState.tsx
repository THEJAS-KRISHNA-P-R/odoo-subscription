'use client';

import React from 'react';
import { Pill } from './Pill';
import { EmptyStateArt } from './MellowArt';

export interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  message,
  actionLabel,
  onAction,
  illustration,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`bg-[var(--bg-surface)] rounded-[24px] px-8 py-12 text-center flex flex-col items-center justify-center gap-4 ${className}`}
    >
      <div className="flex items-center justify-center">
        {illustration ?? <EmptyStateArt />}
      </div>
      <p className="text-[15px] font-medium text-[var(--text-secondary)] max-w-md">{message}</p>
      {actionLabel && onAction && (
        <div className="pt-1">
          <Pill variant="primary" onClick={onAction}>
            {actionLabel}
          </Pill>
        </div>
      )}
    </div>
  );
}
