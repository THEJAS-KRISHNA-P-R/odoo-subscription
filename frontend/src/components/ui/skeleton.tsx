"use client";

import { ReactNode } from "react";

export interface SkeletonProps {
  className?: string;
  rows?: number;
}

export const Skeleton = ({
  className,
  rows = 3,
}: SkeletonProps) => {
  const baseClass = "animate-bounce rounded-bg-surface min-h-8 block";

  return (
    <div className={`space-y-2 ${baseClass} ${className}`}>
      {Array.from({ length: rows }, () => (
        <div className="h-6 rounded w-full animate-pulse" />
      ))}
    </div>
  );
};