'use client';

import React from 'react';

export interface SkeletonProps {
  rows?: number;
  heightClass?: string;
  className?: string;
}

export function Skeleton({ rows = 4, heightClass = 'h-[60px]', className = '' }: SkeletonProps) {
  return (
    <div
      className={`space-y-2 ${className}`}
      role="status"
      aria-live="polite"
      aria-label="Loading content"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`w-full ${heightClass} rounded-[16px] bg-[var(--bg-surface)] animate-pulse`}
        />
      ))}
    </div>
  );
}
