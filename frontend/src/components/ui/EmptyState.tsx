'use client';

import React from 'react';
import { Inbox } from 'lucide-react';
import { Pill } from './Pill';

export interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ message, actionLabel, onAction, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`bg-[var(--bg-surface)] rounded-[24px] px-8 py-12 text-center flex flex-col items-center justify-center gap-4 ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-[var(--bg-card)] text-[var(--text-muted)] flex items-center justify-center">
        <Inbox className="w-6 h-6" aria-hidden="true" />
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
