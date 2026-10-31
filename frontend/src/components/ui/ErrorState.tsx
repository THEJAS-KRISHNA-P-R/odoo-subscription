'use client';

import React from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';
import { Pill } from './Pill';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className = '' }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-[24px] px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}
    >
      <div className="flex items-start sm:items-center gap-3.5 text-left">
        <div className="w-10 h-10 rounded-full bg-[var(--bg-card)] text-[var(--danger-fg)] flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">
            Could not load data from server
          </div>
          <p className="text-[13px] text-[var(--danger-fg)] mt-0.5">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Pill variant="outline" onClick={onRetry}>
          <RotateCw className="w-4 h-4" aria-hidden="true" />
          <span>Retry</span>
        </Pill>
      )}
    </div>
  );
}
